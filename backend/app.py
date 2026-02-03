import os
import asyncio
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# LangChain imports
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

import logging
import uuid
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Database Setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chatbot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class ChatSession(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('Message', backref='session', lazy=True, cascade="all, delete-orphan")

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(36), db.ForeignKey('chat_session.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Groq model initialization
try:
    llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        temperature=0.7,
        max_retries=2,
    )
except Exception as e:
    logger.error(f"Failed to initialize Groq LLM: {str(e)}")
    llm = None

# RAG Setup
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = None
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SYSTEM_PROMPT = "You are a helpful assistant. Keep your responses concise and friendly."

with app.app_context():
    db.create_all()

def get_rag_context(query):
    global vector_store
    if vector_store:
        docs = vector_store.similarity_search(query, k=3)
        return "\n\n".join([doc.page_content for doc in docs])
    return ""

async def get_assistant_response(user_message, session_id):
    if not llm:
        raise ValueError("LLM not initialized properly.")
    
    # Fetch history from DB
    history = Message.query.filter_by(session_id=session_id).order_by(Message.created_at).all()
    
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    
    # Add RAG context if available
    context = get_rag_context(user_message)
    if context:
        context_prompt = f"\n\nContext from uploaded documents:\n{context}"
        messages[0].content += context_prompt

    # Add history
    for msg in history:
        if msg.role == 'user':
            messages.append(HumanMessage(content=msg.content))
        else:
            messages.append(AIMessage(content=msg.content))
            
    # Add current message
    messages.append(HumanMessage(content=user_message))
    
    # Save user message to DB
    user_msg = Message(session_id=session_id, role='user', content=user_message)
    db.session.add(user_msg)
    
    # Invoke AI
    response = await llm.ainvoke(messages)
    
    # Save AI response to DB
    ai_msg = Message(session_id=session_id, role='assistant', content=response.content)
    db.session.add(ai_msg)
    db.session.commit()
    
    return response.content

@app.route("/sessions", methods=["GET"])
def get_sessions():
    sessions = ChatSession.query.order_by(ChatSession.created_at.desc()).all()
    return jsonify([{
        "id": s.id,
        "title": s.title,
        "created_at": s.created_at.isoformat()
    } for s in sessions])

@app.route("/sessions", methods=["POST"])
def create_session():
    new_session = ChatSession(title="New Chat")
    db.session.add(new_session)
    db.session.commit()
    return jsonify({"id": new_session.id, "title": new_session.title})

@app.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    session = ChatSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    db.session.delete(session)
    db.session.commit()
    return jsonify({"status": "deleted"})

@app.route("/sessions/<session_id>/messages", methods=["GET"])
def get_messages(session_id):
    messages = Message.query.filter_by(session_id=session_id).order_by(Message.created_at).all()
    return jsonify([{
        "role": m.role,
        "content": m.content,
        "created_at": m.created_at.isoformat()
    } for m in messages])

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message")
        session_id = data.get("sessionId")

        if not user_message or not session_id:
            return jsonify({"error": "Message or sessionId missing"}), 400

        # Run async function
        response = asyncio.run(get_assistant_response(user_message, session_id))
        return jsonify({"response": response})

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/upload", methods=["POST"])
def upload_file():
    global vector_store
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Index the file
        try:
            loader = PyPDFLoader(filepath)
            documents = loader.load()
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_offset=200)
            splits = text_splitter.split_documents(documents)
            
            if vector_store:
                vector_store.add_documents(splits)
            else:
                vector_store = FAISS.from_documents(splits, embeddings)
                
            return jsonify({"message": f"File {filename} indexed successfully"})
        except Exception as e:
            logger.error(f"Indexing error: {str(e)}")
            return jsonify({"error": f"Failed to index: {str(e)}"}), 500

@app.route("/health")
def health():
    return jsonify({"status": "ok", "db": "operational", "rag_ready": vector_store is not None})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
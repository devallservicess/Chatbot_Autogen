import os
import asyncio
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.chat_history import InMemoryChatMessageHistory
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Groq model initialization using LangChain
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

SYSTEM_PROMPT = "You are a helpful assistant. Keep your responses concise and friendly."

# In-memory store for chat histories
# For a 10/10 production app, this would be a database like SQLite or Redis
chat_histories = {}

def get_session_history(session_id: str) -> InMemoryChatMessageHistory:
    if session_id not in chat_histories:
        chat_histories[session_id] = InMemoryChatMessageHistory()
    return chat_histories[session_id]

async def get_assistant_response(user_message: str, session_id: str = "default") -> str:
    if not llm:
        raise ValueError("LLM not initialized properly. Check your GROQ_API_KEY.")
    
    try:
        # Get history for this session
        history = get_session_history(session_id)
        
        # Add human message to history
        history.add_user_message(user_message)
        
        # Build the full prompt: System Message + History
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + history.messages
        
        # Invoke the LLM
        response = await llm.ainvoke(messages)
        
        # Add AI response to history
        history.add_ai_message(response.content)
        
        return response.content
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        raise

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message")
        session_id = data.get("sessionId", "default")

        if not user_message:
            return jsonify({"error": "Message is empty"}), 400

        # Check if API key is set
        if not os.getenv("GROQ_API_KEY"):
            return jsonify({
                "error": "Groq API key not configured. Please add GROQ_API_KEY to your .env file"
            }), 500

        # Use sync runner for the async function
        response = asyncio.run(get_assistant_response(user_message, session_id))
        return jsonify({"response": response})

    except Exception as e:
        error_message = str(e)
        logger.error(f"Chat error: {error_message}")
        
        # Handle specific errors
        if "quota" in error_message.lower() or "limit" in error_message.lower():
            return jsonify({
                "error": "Groq API limit exceeded or quota issue."
            }), 429
        elif "authentication" in error_message.lower() or "invalid_api_key" in error_message.lower():
            return jsonify({
                "error": "Invalid Groq API key. Please check your .env file"
            }), 401
        else:
            return jsonify({
                "error": f"Error: {error_message}"
            }), 500

@app.route("/health")
def health():
    # Check if API key is configured
    api_key_configured = bool(os.getenv("GROQ_API_KEY"))
    return jsonify({
        "status": "ok",
        "api_key_configured": api_key_configured,
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "active_sessions": len(chat_histories)
    })

if __name__ == "__main__":
    # Verify API key on startup
    if not os.getenv("GROQ_API_KEY"):
        logger.warning("⚠️  WARNING: GROQ_API_KEY not found in environment variables!")
    else:
        logger.info("✓ Groq API key found")
    
    logger.info("🚀 Backend démarré sur http://localhost:5000")
    app.run(port=5000, debug=True)
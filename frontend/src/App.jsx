import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, Sparkles, Terminal,
  PlusCircle, MessageSquare, Trash2, Upload, FileText, X
} from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

function App() {
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Initialize: Fetch sessions
  useEffect(() => {
    fetchSessions()
  }, [])

  // When session changes, fetch its messages
  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId)
    } else {
      setMessages([])
    }
  }, [currentSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/sessions`)
      setSessions(res.data)
      if (res.data.length > 0 && !currentSessionId) {
        setCurrentSessionId(res.data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err)
    }
  }

  const createNewSession = async () => {
    try {
      const res = await axios.post(`${API_URL}/sessions`)
      setSessions([res.data, ...sessions])
      setCurrentSessionId(res.data.id)
    } catch (err) {
      console.error('Failed to create session', err)
    }
  }

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    try {
      await axios.delete(`${API_URL}/sessions/${id}`)
      const newSessions = sessions.filter(s => s.id !== id)
      setSessions(newSessions)
      if (currentSessionId === id) {
        setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null)
      }
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  const fetchMessages = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/sessions/${id}/messages`)
      setMessages(res.data)
    } catch (err) {
      console.error('Failed to fetch messages', err)
    }
  }

  const sendMessage = async () => {
    const message = inputValue.trim()
    if (!message || !currentSessionId || isLoading) return

    const userMsg = { role: 'user', content: message }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        message,
        sessionId: currentSessionId
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ Connection Error" }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus("Uploading & Indexing...")

    const formData = new FormData()
    formData.append('file', file)

    try {
      await axios.post(`${API_URL}/upload`, formData)
      setUploadStatus("✅ File indexed! Knowledge added.")
      setTimeout(() => setUploadStatus(null), 3000)
    } catch (err) {
      setUploadStatus("❌ Failed to index file.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={createNewSession}>
            <PlusCircle size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="sessions-list">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${currentSessionId === s.id ? 'active' : ''}`}
              onClick={() => setCurrentSessionId(s.id)}
            >
              <MessageSquare size={16} />
              <span className="session-title">{s.title}</span>
              <button
                className="delete-session-btn"
                onClick={(e) => deleteSession(e, s.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>System Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="chat-area">
        <header className="chat-header">
          <div className="header-info">
            <Sparkles className="text-accent-icon" size={24} />
            <h2>Groq Assistant Pro</h2>
          </div>
          {uploadStatus && (
            <div className="upload-indicator">
              <FileText size={14} />
              <span>{uploadStatus}</span>
            </div>
          )}
        </header>

        <section className="messages-viewport">
          <AnimatePresence initial={false}>
            {messages.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="empty-state"
              >
                <Bot size={48} className="empty-bot-icon" />
                <h3>How can I help you today?</h3>
                <p>Upload a PDF to chat with your documents, or just start a conversation.</p>
              </motion.div>
            )}
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="message-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="markdown-body"
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar"><Bot size={18} /></div>
              <div className="message-content">
                <div className="typing-indicator">
                  <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <footer className="chat-footer">
          <div className="input-container">
            <button
              className="action-btn"
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
            >
              <Upload size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.txt"
              onChange={handleFileUpload}
            />
            <div className="input-wrapper">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={currentSessionId ? "Message Assistant..." : "Create a new chat to start..."}
                disabled={isLoading || !currentSessionId}
              />
            </div>
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim() || !currentSessionId}
            >
              <Send size={20} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App

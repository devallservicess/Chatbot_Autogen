import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Sparkles, Terminal } from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

function App() {
  const [messages, setMessages] = useState([
    {
      content: "Hello! I'm your high-performance AI assistant. I'm powered by Groq and LangChain, featuring conversational memory. How can I help you today?",
      isUser: false
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    const userMsg = { content: message, isUser: true }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await axios.post(
        `${API_URL}/chat`,
        {
          message,
          sessionId
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      )

      setMessages(prev => [
        ...prev,
        {
          content: response.data.response,
          isUser: false
        }
      ])
    } catch (error) {
      console.error('Axios error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      setMessages(prev => [
        ...prev,
        {
          content: `### ❌ Connection Error\n${errorMessage}`,
          isUser: false
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="chat-container"
      >
        <header className="chat-header">
          <div className="header-title">
            <Sparkles className="text-accent" size={24} />
            <span>Groq Assistant v2</span>
          </div>
          <div className="status-badge">
            <div className="status-dot"></div>
            <span>Llama 3.3 70B Active</span>
          </div>
        </header>

        <main className="chat-messages">
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10, x: msg.isUser ? 20 : -20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`message ${msg.isUser ? 'user' : 'assistant'}`}
              >
                <div className="message-avatar">
                  {msg.isUser ? <User size={20} /> : <Bot size={20} />}
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
                            style={atomDark}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="message assistant"
            >
              <div className="message-avatar">
                <Bot size={20} />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="chat-input-container">
          <div className="input-wrapper">
            <Terminal size={18} className="absolute left-4 text-secondary pointer-events-none opacity-40" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or command..."
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="send-button"
          >
            <Send size={20} />
          </motion.button>
        </footer>
      </motion.div>
    </div>
  )
}

export default App

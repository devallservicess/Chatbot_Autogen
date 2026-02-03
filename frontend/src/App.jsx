import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'

console.log('API_URL:', API_URL)

function App() {
  const [messages, setMessages] = useState([
    {
      content: "Hello! I'm your AI assistant. How can I help you today?",
      isUser: false
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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

    const newMessages = [...messages, { content: message, isUser: true }]
    setMessages(newMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await axios.post(
        `${API_URL}/chat`,
        { message },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      setMessages([
        ...newMessages,
        {
          content: response.data.response,
          isUser: false
        }
      ])
    } catch (error) {
      console.error('Axios error:', error)

      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        'Unknown error'

      setMessages([
        ...newMessages,
        {
          content: `❌ Backend error: ${errorMessage}`,
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
      <div className="chat-container">
        <div className="chat-header">
          🤖 AI Chat Assistant
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.isUser ? 'user' : 'assistant'}`}
            >
              <div className="message-content">{msg.content}</div>
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <div className="typing-indicator">
                <span className="loading"></span>
                <span className="loading"></span>
                <span className="loading"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            disabled={isLoading}
            autoComplete="off"
          />
          <button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default App

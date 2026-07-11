import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Bot, User, Loader2, MessageCircle, FileText, CheckSquare, Sparkles } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { type: string; id: string; label: string; projectName?: string }[]
  createdAt: string
}

export function SmartChat() {
  const { t } = useTranslation('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const SUGGESTED_QUESTIONS = [
    t('suggestedRecentDecisions'),
    t('suggestedBlockers'),
    t('suggestedWeekSummary'),
    t('suggestedPending'),
    t('suggestedOverdueTasks'),
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await window.electronAPI.smartChatSend(messageText)
      setMessages((prev) => [...prev, response as ChatMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('errorMessage'),
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'entry': return <FileText size={10} />
      case 'task': return <CheckSquare size={10} />
      default: return <FileText size={10} />
    }
  }

  return (
    <div className="smart-chat">
      <div className="smart-chat-header">
        <MessageCircle size={16} />
        <span>{t('headerTitle')}</span>
        <span className="smart-chat-badge">{t('badge')}</span>
      </div>

      <div className="smart-chat-messages">
        {messages.length === 0 && (
          <div className="smart-chat-welcome">
            <div className="smart-chat-welcome-icon">
              <Sparkles size={32} />
            </div>
            <h3>{t('welcomeTitle')}</h3>
            <p>{t('welcomeSubtitle')}</p>
            <div className="smart-chat-suggestions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="smart-chat-suggestion"
                  onClick={() => handleSend(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`smart-chat-message ${msg.role}`}>
            <div className="smart-chat-message-avatar">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="smart-chat-message-content">
              {msg.role === 'assistant' ? (
                <MarkdownViewer content={msg.content} />
              ) : (
                <p>{msg.content}</p>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="smart-chat-sources">
                  <span className="smart-chat-sources-label">{t('sources')}</span>
                  {msg.sources.map((source, i) => (
                    <span key={i} className="smart-chat-source-chip">
                      {getSourceIcon(source.type)}
                      <span>{source.label}</span>
                      {source.projectName && (
                        <span className="smart-chat-source-project">{source.projectName}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="smart-chat-message assistant">
            <div className="smart-chat-message-avatar">
              <Bot size={14} />
            </div>
            <div className="smart-chat-message-content">
              <div className="smart-chat-typing">
                <Loader2 size={14} className="spinning" />
                <span>{t('typing')}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="smart-chat-input-area">
        <textarea
          ref={inputRef}
          className="smart-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          rows={1}
          disabled={isLoading}
        />
        <button
          className="smart-chat-send"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          aria-label={t('sendMessage')}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

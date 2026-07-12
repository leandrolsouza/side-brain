import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Bot, User, Loader2, MessageCircle, FileText, CheckSquare, Sparkles, Plus, Trash2, MessageSquare, MoreHorizontal, Pencil, X } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

interface ChatMessage {
  id: string
  conversationId?: string
  role: 'user' | 'assistant'
  content: string
  sources?: { type: string; id: string; label: string; projectName?: string }[]
  actions?: { type: string; success: boolean; description: string; data?: Record<string, any> }[]
  createdAt: string
}

interface ChatConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export function SmartChat() {
  const { t } = useTranslation('chat')

  // Conversation state
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const SUGGESTED_QUESTIONS = [
    t('suggestedRecentDecisions'),
    t('suggestedBlockers'),
    t('suggestedWeekSummary'),
    t('suggestedPending'),
    t('suggestedOverdueTasks'),
    t('suggestedOpenRequests'),
    t('suggestedRequestsByProject'),
    t('suggestedUrgentRequests'),
    t('suggestedRequestsWaiting'),
    t('suggestedRecentIdeas'),
    t('suggestedProjectProgress'),
    t('suggestedUpdatesToday'),
    t('suggestedNextActions'),
  ]

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when conversation changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeConversationId])

  const loadConversations = async () => {
    try {
      const convs = await window.electronAPI.smartChatGetConversations()
      setConversations(convs)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const msgs = await window.electronAPI.smartChatGetMessages(conversationId)
      setMessages(msgs)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    }
  }

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId)
    await loadMessages(conversationId)
    setContextMenuId(null)
  }, [])

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setContextMenuId(null)
    inputRef.current?.focus()
  }, [])

  const handleDeleteConversation = async (id: string) => {
    try {
      await window.electronAPI.smartChatDeleteConversation(id)
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setContextMenuId(null)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleRenameConversation = async (id: string) => {
    if (!editingTitle.trim()) return
    try {
      await window.electronAPI.smartChatRenameConversation(id, editingTitle.trim())
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
      )
      setEditingId(null)
      setEditingTitle('')
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    }
  }

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
      const response = await window.electronAPI.smartChatSend(messageText, activeConversationId || undefined)

      // If this was a new conversation, update state
      if (!activeConversationId && response.conversationId) {
        setActiveConversationId(response.conversationId)
        await loadConversations()
      }

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
        <div className="smart-chat-header-actions">
          <button
            className="smart-chat-header-btn"
            onClick={handleNewConversation}
            title={t('newConversation')}
          >
            <Plus size={14} />
          </button>
          <button
            className="smart-chat-header-btn"
            onClick={() => setShowSidebar(!showSidebar)}
            title={t('toggleHistory')}
          >
            <MessageSquare size={14} />
          </button>
        </div>
      </div>

      <div className="smart-chat-body">
        {/* Conversation sidebar */}
        {showSidebar && conversations.length > 0 && (
          <div className="smart-chat-sidebar">
            <div className="smart-chat-sidebar-header">
              <span>{t('conversations')}</span>
            </div>
            <div className="smart-chat-sidebar-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`smart-chat-sidebar-item ${conv.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  {editingId === conv.id ? (
                    <div className="smart-chat-sidebar-edit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConversation(conv.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleRenameConversation(conv.id)}
                        autoFocus
                        className="smart-chat-sidebar-edit-input"
                      />
                    </div>
                  ) : (
                    <>
                      <span className="smart-chat-sidebar-item-title">{conv.title}</span>
                      <button
                        className="smart-chat-sidebar-item-menu"
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenuId(contextMenuId === conv.id ? null : conv.id)
                        }}
                      >
                        <MoreHorizontal size={12} />
                      </button>
                    </>
                  )}
                  {contextMenuId === conv.id && (
                    <div className="smart-chat-context-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingId(conv.id)
                          setEditingTitle(conv.title)
                          setContextMenuId(null)
                        }}
                      >
                        <Pencil size={11} />
                        <span>{t('rename')}</span>
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDeleteConversation(conv.id)}
                      >
                        <Trash2 size={11} />
                        <span>{t('delete')}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div className="smart-chat-main">
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
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="smart-chat-actions">
                      {msg.actions.map((action, i) => (
                        <div key={i} className={`smart-chat-action-chip ${action.success ? 'success' : 'error'}`}>
                          <span className="smart-chat-action-icon">{action.success ? '✓' : '✗'}</span>
                          <span>{action.description}</span>
                        </div>
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
      </div>
    </div>
  )
}

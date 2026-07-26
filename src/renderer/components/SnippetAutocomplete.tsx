import type React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap } from 'lucide-react'
import type { CaptureSnippet } from '@shared/types'

interface SnippetAutocompleteProps {
  /** Current text in the textarea */
  text: string
  /** Position of the cursor in the textarea */
  cursorPosition: number
  /** All available snippets */
  snippets: CaptureSnippet[]
  /** Whether the dropdown should be shown */
  isVisible: boolean
  /** Callback when a snippet is selected */
  onSelect: (snippet: CaptureSnippet, replacementRange: { start: number; end: number }) => void
  /** Callback to close the menu */
  onClose: () => void
  /** Anchor element for positioning */
  anchorRef: React.RefObject<HTMLTextAreaElement | null>
}

export function SnippetAutocomplete({
  text,
  cursorPosition,
  snippets,
  isVisible,
  onSelect,
  onClose,
  anchorRef,
}: SnippetAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filteredSnippets, setFilteredSnippets] = useState<CaptureSnippet[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  // Extract the current trigger query (text after the last '/')
  const getTriggerQuery = useCallback((): { query: string; start: number } | null => {
    if (!isVisible) return null

    // Look backwards from cursor for '/'
    const textBeforeCursor = text.slice(0, cursorPosition)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    if (lastSlashIndex === -1) return null

    // The slash must be at start of line or after a space
    if (
      lastSlashIndex > 0 &&
      textBeforeCursor[lastSlashIndex - 1] !== ' ' &&
      textBeforeCursor[lastSlashIndex - 1] !== '\n'
    ) {
      return null
    }

    const query = textBeforeCursor.slice(lastSlashIndex + 1)

    // Don't show if query has spaces (means user moved past the trigger)
    if (query.includes(' ') || query.includes('\n')) return null

    return { query, start: lastSlashIndex }
  }, [text, cursorPosition, isVisible])

  // Filter snippets based on query
  useEffect(() => {
    const trigger = getTriggerQuery()
    if (!trigger) {
      setFilteredSnippets([])
      return
    }

    const query = trigger.query.toLowerCase()
    const filtered = snippets.filter(
      (s) => s.triggerKey.toLowerCase().startsWith(query) || s.label.toLowerCase().includes(query)
    )
    setFilteredSnippets(filtered)
    setSelectedIndex(0)
  }, [text, cursorPosition, snippets, getTriggerQuery])

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible || filteredSnippets.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev + 1) % filteredSnippets.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev - 1 + filteredSnippets.length) % filteredSnippets.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          e.stopPropagation()
          handleSelect(filteredSnippets[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isVisible, filteredSnippets, selectedIndex, onClose])

  const handleSelect = useCallback(
    (snippet: CaptureSnippet) => {
      const trigger = getTriggerQuery()
      if (!trigger) return

      // The replacement range is from the '/' to the current cursor position
      onSelect(snippet, { start: trigger.start, end: cursorPosition })

      // Track usage
      window.electronAPI.incrementSnippetUsage(snippet.id).catch(() => {})
    },
    [getTriggerQuery, cursorPosition, onSelect]
  )

  if (!isVisible || filteredSnippets.length === 0) return null

  return (
    <div className="snippet-autocomplete" ref={menuRef}>
      <div className="snippet-autocomplete-header">
        <Zap size={12} />
        <span>Snippets</span>
      </div>
      <div className="snippet-autocomplete-list">
        {filteredSnippets.map((snippet, index) => (
          <button
            type="button"
            key={snippet.id}
            className={`snippet-autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => handleSelect(snippet)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="snippet-trigger">/{snippet.triggerKey}</span>
            <span className="snippet-label">{snippet.label}</span>
          </button>
        ))}
      </div>
      <div className="snippet-autocomplete-hint">
        <kbd>↑↓</kbd> navegar <kbd>Enter</kbd> inserir <kbd>Esc</kbd> fechar
      </div>
    </div>
  )
}

/**
 * Hook to detect when the snippet autocomplete should be triggered.
 * Returns true when the user types '/' at start of line or after a space.
 */
export function useSnippetTrigger(text: string, cursorPosition: number): boolean {
  const [isTriggered, setIsTriggered] = useState(false)

  useEffect(() => {
    if (cursorPosition === 0) {
      setIsTriggered(false)
      return
    }

    const textBeforeCursor = text.slice(0, cursorPosition)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    if (lastSlashIndex === -1) {
      setIsTriggered(false)
      return
    }

    // Slash must be at position 0 or after whitespace
    const isValidPosition =
      lastSlashIndex === 0 ||
      textBeforeCursor[lastSlashIndex - 1] === ' ' ||
      textBeforeCursor[lastSlashIndex - 1] === '\n'

    if (!isValidPosition) {
      setIsTriggered(false)
      return
    }

    // Text after slash must not contain spaces
    const afterSlash = textBeforeCursor.slice(lastSlashIndex + 1)
    const hasNoSpaces = !afterSlash.includes(' ') && !afterSlash.includes('\n')

    setIsTriggered(hasNoSpaces)
  }, [text, cursorPosition])

  return isTriggered
}

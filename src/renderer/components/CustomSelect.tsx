import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomSelect({ options, value, onChange, placeholder, disabled, className }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label || placeholder || 'Selecionar...'

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isOpen && highlightIndex >= 0) {
        onChange(options[highlightIndex].value)
        setIsOpen(false)
      } else {
        setIsOpen(true)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        setHighlightIndex((prev) => Math.min(prev + 1, options.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, isOpen])

  // Reset highlight when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((o) => o.value === value)
      setHighlightIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={`custom-select ${className || ''} ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <div className="custom-select-trigger" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span className="custom-select-value">
          {selectedOption?.icon && <span className="custom-select-icon">{selectedOption.icon}</span>}
          {displayLabel}
        </span>
        <ChevronDown size={14} className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select-dropdown" ref={listRef}>
          {options.map((option, idx) => (
            <div
              key={option.value}
              className={`custom-select-option ${option.value === value ? 'selected' : ''} ${idx === highlightIndex ? 'highlighted' : ''}`}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              {option.icon && <span className="custom-select-option-icon">{option.icon}</span>}
              <span className="custom-select-option-label">{option.label}</span>
              {option.value === value && <Check size={14} className="custom-select-check" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnnotationType } from '@/types/annotation'
import { DEFAULT_COLORS } from '@/types/annotation'
import { cn } from '@/lib/utils'

// SVG icons for annotation types
const TypeIcons = {
  highlight: (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M9 11l-6 6v3h9l3-3' />
      <path d='M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4' />
    </svg>
  ),
  underline: (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M6 4v6a6 6 0 0012 0V4' />
      <line x1='4' y1='20' x2='20' y2='20' />
    </svg>
  ),
  strikethrough: (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M16 4H9a3 3 0 00-3 3v0a3 3 0 003 3h6a3 3 0 013 3v0a3 3 0 01-3 3H8' />
      <line x1='4' y1='12' x2='20' y2='12' />
    </svg>
  ),
  squiggly: (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M4 19c0-4 8-4 8-8s-8-4-8-8' />
      <path d='M12 19c0-4 8-4 8-8s-8-4-8-8' />
      <line x1='4' y1='21' x2='20' y2='21' />
    </svg>
  ),
  outline: (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
    </svg>
  ),
}

interface AnnotationToolbarProps {
  position: { x: number; y: number }
  onSelectType: (type: AnnotationType, color: string) => void
  onAddNote?: () => void
  onClose: () => void
  selectedText?: string
}

export function AnnotationToolbar({
  position,
  onSelectType,
  onAddNote,
  onClose,
  selectedText,
}: AnnotationToolbarProps) {
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0].value)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [customColor, setCustomColor] = useState('#FFEB3B')
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleTypeClick = (type: AnnotationType) => {
    const color = showColorPicker && customColor ? customColor : selectedColor
    onSelectType(type, color)
    onClose()
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    setCustomColor(color)
  }

  // Calculate position (keep toolbar in viewport)
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.max(position.y - 120, 10),
    zIndex: 1000,
  }

  return (
    <div
      ref={toolbarRef}
      style={style}
      className='bg-background border rounded-lg shadow-lg p-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-150'
      onClick={(e) => e.stopPropagation()}
    >
      {/* Selected text preview */}
      {selectedText && (
        <div className='text-xs text-muted-foreground mb-2 px-2 max-w-[220px] truncate'>
          &ldquo;{selectedText}&rdquo;
        </div>
      )}

      {/* Annotation type buttons */}
      <div className='flex gap-1 mb-2'>
        {(Object.keys(TypeIcons) as AnnotationType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeClick(type)}
            className={cn(
              'p-2 rounded-md transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            title={type.charAt(0).toUpperCase() + type.slice(1)}
          >
            {TypeIcons[type]}
          </button>
        ))}
      </div>

      {/* Color section */}
      <div className='border-t pt-2'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-xs text-muted-foreground'>Color</span>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
          >
            <span
              className='w-4 h-4 rounded border'
              style={{ backgroundColor: showColorPicker && customColor ? customColor : selectedColor }}
            />
            {showColorPicker ? 'Hide' : 'Custom'}
          </button>
        </div>

        {/* Preset colors */}
        <div className='flex flex-wrap gap-1 mb-2'>
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorSelect(color.value)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform',
                selectedColor === color.value && customColor === color.value ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>

        {/* Custom color picker */}
        {showColorPicker && (
          <div className='mt-2'>
            <input
              type='color'
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className='w-full h-8 cursor-pointer'
            />
            <div className='flex items-center gap-2 mt-2'>
              <input
                type='text'
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className='flex-1 px-2 py-1 text-xs border rounded'
                placeholder='#000000'
              />
              <button
                onClick={() => setSelectedColor(customColor)}
                className='px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90'
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add note button */}
      {onAddNote && (
        <div className='border-t pt-2 mt-2'>
          <button
            onClick={() => {
              onAddNote()
              onClose()
            }}
            className='w-full px-3 py-2 text-sm rounded-md bg-accent hover:bg-accent/80 text-accent-foreground transition-colors'
          >
            Add Note
          </button>
        </div>
      )}
    </div>
  )
}
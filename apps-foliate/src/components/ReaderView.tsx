'use client'

import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/store/settings-store'
import { useReaderEvents } from '@/hooks/use-reader-events'
import { updateAllThemes } from '@/services/theme-css'
import '@/types/FoliateView'

interface ReaderViewProps {
  file: File
  lastLocation?: unknown
  onViewReady?: (view: FoliateView) => void
  onRelocate?: (loc: unknown) => void
  onAnnotation?: (type: string, detail: unknown) => void
  onTextSelection?: (state: { text: string; rects: DOMRect[]; bounds: DOMRect } | null) => void
}

export function ReaderView({
  file,
  lastLocation,
  onViewReady,
  onRelocate,
  onAnnotation,
  onTextSelection,
}: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<FoliateView | null>(null)

  const settings = useSettingsStore(
    useShallow((s) => ({
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      margins: s.margins,
      lineHeight: s.lineHeight,
    }))
  )

  useReaderEvents(onRelocate, onAnnotation, onTextSelection)

  useEffect(() => {
    let view: FoliateView | null = null
    let cancelled = false

    ;(async () => {
      await import('foliate-js/view.js')

      if (cancelled) return
      const container = containerRef.current
      if (!container) return

      view = document.createElement('foliate-view') as FoliateView
      view.style.display = 'block'
      view.style.width = '100%'
      view.style.height = '100%'
      container.appendChild(view)

      try {
        await view.open(file)
        await view.init({
          lastLocation: lastLocation ?? undefined,
          showTextStart: !lastLocation,
        })
        viewRef.current = view
        onViewReady?.(view)
      } catch (err) {
        console.error('Failed to open book:', err)
      }
    })()

    return () => {
      cancelled = true
      if (view) {
        view.close()
        view.remove()
        viewRef.current = null
      }
    }
  }, [file])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const view = viewRef.current
      if (!view) return

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        view.next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        view.prev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        view.goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        view.goToFraction(1)
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    container.tabIndex = 0
    container.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [file])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    updateAllThemes(settings, () =>
      (view.renderer as { getContents?: () => { doc?: Document }[] })
        ?.getContents?.() ?? []
    )
  }, [settings])

  return (
    <div
      ref={containerRef}
      className='h-full w-full outline-none relative'
      tabIndex={0}
    />
  )
}

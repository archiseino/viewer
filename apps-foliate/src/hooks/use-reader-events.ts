'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReaderStore } from '@/store/reader-store'
import { useSettingsStore } from '@/store/settings-store'
import { injectTheme } from '@/services/theme-css'
import '@/types/FoliateView'

function attachSelectionListener(
  view: FoliateView,
  doc: Document,
  onTextSelection?: (state: { text: string; rects: DOMRect[]; bounds: DOMRect; cfi?: string } | null) => void
) {
  const handler = () => {
    const sel = doc.defaultView?.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const range = sel.getRangeAt(0)
    const rects = Array.from(range.getClientRects())
    if (rects.length === 0) return

    const iframe = doc.defaultView?.frameElement as HTMLElement | null
    if (!iframe) return
    const iframeRect = iframe.getBoundingClientRect()

    const viewportRects = rects.map(r => new DOMRect(
      r.x + iframeRect.left,
      r.y + iframeRect.top,
      r.width,
      r.height
    ))

    const minX = Math.min(...viewportRects.map(r => r.x))
    const minY = Math.min(...viewportRects.map(r => r.y))
    const maxRight = Math.max(...viewportRects.map(r => r.right))
    const maxBottom = Math.max(...viewportRects.map(r => r.bottom))
    const bounds = new DOMRect(minX, minY, maxRight - minX, maxBottom - minY)

    // Find the section index for this document and generate a precise CFI
    const contents = view.renderer?.getContents?.() ?? []
    const content = contents.find(c => c.doc === doc)
    const cfi = content?.index != null ? view.getCFI(content.index, range) : undefined

    onTextSelection?.({ text, rects: viewportRects, bounds, cfi })
  }

  doc.addEventListener('mouseup', handler)
  doc.addEventListener('touchend', handler)
}

export function useReaderEvents(
  onRelocate?: (loc: unknown) => void,
  onAnnotation?: (type: string, detail: unknown) => void,
  onTextSelection?: (state: { text: string; rects: DOMRect[]; bounds: DOMRect; cfi?: string } | null) => void,
) {
  const view = useReaderStore((s) => s.viewRef)
  const setLocation = useReaderStore((s) => s.setLocation)
  const setToc = useReaderStore((s) => s.setToc)
  const settings = useSettingsStore(
    useShallow((s) => ({
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      margins: s.margins,
      lineHeight: s.lineHeight,
    }))
  )

  useEffect(() => {
    if (!view) return

    const handleRelocate = (e: CustomEvent) => {
      const detail = e.detail
      const { range: _, ...location } = detail
      setLocation(location)
      onRelocate?.(location)
    }

    const handleLoad = (e: CustomEvent) => {
      const doc = e.detail.doc as Document
      if (doc) {
        injectTheme(doc, settings)
        attachSelectionListener(view, doc, onTextSelection)
      }
    }

    const handleShowAnnotation = (e: CustomEvent) => {
      onAnnotation?.('show', e.detail)
    }

    view.addEventListener('relocate', handleRelocate as EventListener)
    view.addEventListener('load', handleLoad as EventListener)
    view.addEventListener('show-annotation', handleShowAnnotation as EventListener)

    if (view.book?.toc) setToc(view.book.toc)

    // Attach listeners to any already-loaded content
    for (const { doc } of view.renderer?.getContents?.() ?? []) {
      if (doc) attachSelectionListener(view, doc, onTextSelection)
    }

    return () => {
      view.removeEventListener('relocate', handleRelocate as EventListener)
      view.removeEventListener('load', handleLoad as EventListener)
      view.removeEventListener('show-annotation', handleShowAnnotation as EventListener)
    }
  }, [view, settings, onAnnotation, onTextSelection])
}

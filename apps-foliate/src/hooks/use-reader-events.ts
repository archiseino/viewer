'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReaderStore } from '@/store/reader-store'
import { useSettingsStore } from '@/store/settings-store'
import { injectTheme } from '@/services/theme-css'
import '@/types/FoliateView'

export function useReaderEvents(
  view: FoliateView | null,
  onRelocate?: (loc: unknown) => void,
) {
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
      if (doc) injectTheme(doc, settings)
    }

    view.addEventListener('relocate', handleRelocate as EventListener)
    view.addEventListener('load', handleLoad as EventListener)

    if (view.book?.toc) setToc(view.book.toc)

    return () => {
      view.removeEventListener('relocate', handleRelocate as EventListener)
      view.removeEventListener('load', handleLoad as EventListener)
    }
  }, [view, settings])
}

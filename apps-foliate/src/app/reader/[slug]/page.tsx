'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Overlayer } from 'foliate-js/overlayer.js'
import { ReaderView } from '@/components/ReaderView'
import { ReaderSidebar } from '@/components/ReaderSidebar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { AnnotationToolbar } from '@/components/AnnotationToolbar'
import { AnnotationNoteDialog } from '@/components/AnnotationNoteDialog'
import { useReaderStore } from '@/store/reader-store'
import { useProgress } from '@/hooks/use-progress'
import { useAnnotations } from '@/hooks/use-annotations'
import { createBookId } from '@/store/annotation-store'
import type { AnnotationType, SerializedRect } from '@/types/annotation'
import type { Annotation } from '@/types/annotation'
import '@/types/FoliateView'
import { List, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Book {
  id: string
  title: string
  author: string
  filename: string
}

const DRAW_FUNCTIONS: Record<string, (rects: DOMRect[] | DOMRectList, options?: Record<string, unknown>) => SVGElement> = {
  highlight: Overlayer.highlight,
  underline: Overlayer.underline,
  strikethrough: Overlayer.strikethrough,
  squiggly: Overlayer.squiggly,
  outline: Overlayer.outline,
}

export default function ReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [toolbarState, setToolbarState] = useState<{
    position: { x: number; y: number }
    text: string
    rects: DOMRect[]
    bounds: DOMRect
    cfi?: string
    pageIndex?: number
    localRects?: SerializedRect[]
    range?: Range
  } | null>(null)
  const [noteDialogState, setNoteDialogState] = useState<{
    open: boolean
    text: string
    cfi?: string
    pageIndex?: number
    annotationId?: string
    existingNote?: string
  }>({ open: false, text: '' })

  const viewRef = useRef<FoliateView | null>(null)

  const setViewRef = useReaderStore((s) => s.setViewRef)
  const setTitleStore = useReaderStore((s) => s.setTitle)

  const filename = file?.name ?? null
  const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false
  const { lastLocation, saveProgress } = useProgress(filename)

  const bookId = file ? createBookId(file) : ''
  const {
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations({ bookId })

  const annotationsRef = useRef(annotations)
  annotationsRef.current = annotations

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/data/books.json')
        const books: Book[] = await res.json()
        if (cancelled) return
        const found = books.find((b) => b.id === slug)
        if (!found) {
          if (!cancelled) { setError('Book not found'); setLoading(false) }
          return
        }
        const fileRes = await fetch(`/data/${encodeURI(found.filename)}`)
        const blob = await fileRes.blob()
        if (cancelled) return
        const f = new File([blob], found.filename, { type: blob.type })
        setFile(f)
        setTitle(found.title)
        setTitleStore(found.title)
        setLoading(false)
      } catch {
        if (!cancelled) { setError('Failed to load book'); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, setTitleStore])

  useEffect(() => {
    document.title = file ? `${title} - Foliate Reader` : 'Foliate Reader'
  }, [title, file])

  const handleRelocate = useCallback(
    (loc: unknown) => { saveProgress(loc as Parameters<typeof saveProgress>[0]) },
    [saveProgress]
  )

  const handleTextSelection = useCallback(
    (state: {
      text: string
      rects: DOMRect[]
      bounds: DOMRect
      cfi?: string
      pageIndex?: number
      localRects?: SerializedRect[]
      range?: Range
    } | null) => {
      if (state) {
        setToolbarState({
          position: { x: state.bounds.x, y: state.bounds.y },
          text: state.text,
          rects: state.rects,
          bounds: state.bounds,
          cfi: state.cfi,
          pageIndex: state.pageIndex,
          localRects: state.localRects,
          range: state.range,
        })
      }
    },
    []
  )

  const handleSelectType = useCallback(
    async (type: AnnotationType, color: string) => {
      if (!viewRef.current || !toolbarState) return
      const view = viewRef.current

      if (isPDF && toolbarState.pageIndex != null && toolbarState.range) {
        const contents = view.renderer.getContents?.() ?? []
        const content = contents.find(c => c.index === toolbarState.pageIndex)
        if (content?.overlayer) {
          const annotation = addAnnotation({
            type, color, text: toolbarState.text,
            value: toolbarState.pageIndex, rects: toolbarState.localRects,
          })
          if (annotation) {
            const drawFn = DRAW_FUNCTIONS[type] ?? Overlayer.highlight
            content.overlayer.add(annotation.id, toolbarState.range, drawFn, { color })
          }
        }
      } else {
        const value: string = toolbarState.cfi ?? ''
        addAnnotation({ type, color, text: toolbarState.text, value })
        if (value) {
          try { await view.addAnnotation({ value, type }) } catch (err) { console.error(err) }
        }
      }
      setToolbarState(null)
    },
    [toolbarState, addAnnotation, isPDF]
  )

  const handleAddNote = useCallback(() => {
    if (!toolbarState) return
    setNoteDialogState({
      open: true, text: toolbarState.text,
      cfi: toolbarState.cfi, pageIndex: toolbarState.pageIndex,
    })
    setToolbarState(null)
  }, [toolbarState])

  const handleCloseToolbar = useCallback(() => { setToolbarState(null) }, [])

  const handleSaveNote = useCallback(
    async (note: string) => {
      if (!noteDialogState.text || !viewRef.current) return
      if (isPDF && noteDialogState.pageIndex != null) {
        addAnnotation({
          type: 'highlight', color: '#FFEB3B',
          text: noteDialogState.text, value: noteDialogState.pageIndex, note,
        })
      } else {
        const value: string = noteDialogState.cfi ?? ''
        addAnnotation({ type: 'highlight', color: '#FFEB3B', text: noteDialogState.text, value, note })
        if (value) {
          try { await viewRef.current.addAnnotation({ value, type: 'highlight' }) } catch {}
        }
      }
      setNoteDialogState({ open: false, text: '' })
    },
    [noteDialogState, addAnnotation, isPDF]
  )

  const handleAnnotationEdit = useCallback(
    (annotation: { id: string; note?: string; text: string; value?: string | number; rects?: SerializedRect[] }) => {
      setNoteDialogState({
        open: true, text: annotation.text,
        cfi: typeof annotation.value === 'number' ? undefined : annotation.value,
        pageIndex: typeof annotation.value === 'number' ? annotation.value : undefined,
        annotationId: annotation.id, existingNote: annotation.note,
      })
    }, []
  )

  const handleAnnotationDelete = useCallback(
    (annotation: { id: string; value: string | number; rects?: SerializedRect[] }) => {
      if (viewRef.current && annotation.value !== '' && annotation.value != null) {
        if (isPDF && typeof annotation.value === 'number') {
          const contents = viewRef.current.renderer.getContents?.() ?? []
          const content = contents.find(c => c.index === annotation.value)
          content?.overlayer?.remove(annotation.id)
        } else {
          viewRef.current.deleteAnnotation({ value: annotation.value })
        }
      }
      deleteAnnotation(annotation.id)
    }, [deleteAnnotation, isPDF]
  )

  const handleAnnotationNavigate = useCallback(
    async (annotation: Annotation) => {
      if (!viewRef.current || annotation.value === '' || annotation.value == null) return
      if (isPDF && typeof annotation.value === 'number') {
        await viewRef.current.goTo(annotation.value)
        if (annotation.rects) {
          const contents = viewRef.current.renderer.getContents?.() ?? []
          const content = contents.find(c => c.index === annotation.value)
          if (content?.overlayer) {
            const fakeRange = {
              getClientRects: () => annotation.rects!.map(r => new DOMRect(r.left, r.top, r.width, r.height)),
              getBoundingClientRect: () => {
                const left = Math.min(...annotation.rects!.map(r => r.left))
                const top = Math.min(...annotation.rects!.map(r => r.top))
                const right = Math.max(...annotation.rects!.map(r => r.right))
                const bottom = Math.max(...annotation.rects!.map(r => r.bottom))
                return new DOMRect(left, top, right - left, bottom - top)
              },
            }
            const drawFn = DRAW_FUNCTIONS[annotation.type] ?? Overlayer.highlight
            content.overlayer.add(annotation.id, fakeRange, drawFn, { color: annotation.color })
          }
        }
      } else {
        try { await viewRef.current.showAnnotation({ value: annotation.value }) } catch {}
      }
    }, [isPDF]
  )

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center text-muted-foreground'>
        Loading...
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4'>
        <p className='text-muted-foreground'>{error ?? 'No book loaded'}</p>
        <Button variant='outline' onClick={() => router.push('/')}>
          Back to Library
        </Button>
      </div>
    )
  }

  return (
    <div className='flex h-screen flex-col'>
      <header className='flex h-12 shrink-0 items-center gap-2 border-b px-2'>
        <Button variant='ghost' size='sm' onClick={() => setSidebarOpen(true)}>
          <List className='size-4' />
        </Button>
        <span className='truncate text-sm font-medium'>{title}</span>
        <Button
          variant='ghost'
          size='sm'
          className='ml-auto'
          onClick={() => router.push('/')}
        >
          Back
        </Button>
        <Button variant='ghost' size='sm' onClick={() => setSettingsOpen(true)}>
          <Settings className='size-4' />
        </Button>
      </header>

      <main className='flex min-h-0 flex-1 relative'>
        <ReaderView
          file={file}
          lastLocation={lastLocation ?? undefined}
          onViewReady={(view) => {
            setViewRef(view)
            viewRef.current = view

            view.addEventListener('draw-annotation', ((e: CustomEvent) => {
              const { draw, annotation } = e.detail as { draw?: (fn: Function, opts: Record<string, unknown>) => void; annotation?: Annotation }
              if (typeof draw !== 'function') return
              const drawFn = DRAW_FUNCTIONS[annotation?.type ?? ''] ?? Overlayer.highlight
              draw(drawFn, { color: annotation?.color })
            }) as EventListener)

            const restoreAnnotations = () => {
              for (const ann of annotationsRef.current) {
                if (ann.value === '' || ann.value == null) continue
                if (isPDF && ann.rects && typeof ann.value === 'number') {
                  const contents = view.renderer.getContents?.() ?? []
                  const content = contents.find(c => c.index === ann.value)
                  if (content?.overlayer) {
                    const fakeRange = {
                      getClientRects: () =>
                        ann.rects!.map(r => new DOMRect(r.left, r.top, r.width, r.height)),
                      getBoundingClientRect: () => {
                        const left = Math.min(...ann.rects!.map(r => r.left))
                        const top = Math.min(...ann.rects!.map(r => r.top))
                        const right = Math.max(...ann.rects!.map(r => r.right))
                        const bottom = Math.max(...ann.rects!.map(r => r.bottom))
                        return new DOMRect(left, top, right - left, bottom - top)
                      },
                    }
                    const drawFn = DRAW_FUNCTIONS[ann.type] ?? Overlayer.highlight
                    content.overlayer.add(ann.id, fakeRange, drawFn, { color: ann.color })
                  }
                } else {
                  view.addAnnotation({ value: ann.value, type: ann.type, color: ann.color }).catch(() => {})
                }
              }
            }

            view.addEventListener('create-overlay', restoreAnnotations as EventListener)
            restoreAnnotations()
          }}
          onRelocate={handleRelocate}
          onTextSelection={handleTextSelection}
        />
      </main>

      {toolbarState && (
        <AnnotationToolbar
          position={toolbarState.position}
          selectedText={toolbarState.text}
          onSelectType={handleSelectType}
          onAddNote={handleAddNote}
          onClose={handleCloseToolbar}
        />
      )}

      <AnnotationNoteDialog
        open={noteDialogState.open}
        onOpenChange={(open) => {
          if (!open) setNoteDialogState({ open: false, text: '' })
        }}
        onSave={handleSaveNote}
        initialNote={noteDialogState.existingNote}
        selectedText={noteDialogState.text}
      />

      <ReaderSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        annotations={annotations}
        onAnnotationNavigate={handleAnnotationNavigate}
        onAnnotationEdit={handleAnnotationEdit}
        onAnnotationDelete={handleAnnotationDelete}
      />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

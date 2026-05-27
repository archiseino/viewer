'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
import { BookOpen, FileText, List, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const DRAW_FUNCTIONS: Record<string, (rects: DOMRect[] | DOMRectList, options?: Record<string, unknown>) => SVGElement> = {
  highlight: Overlayer.highlight,
  underline: Overlayer.underline,
  strikethrough: Overlayer.strikethrough,
  squiggly: Overlayer.squiggly,
  outline: Overlayer.outline,
}

interface Book {
  id: string
  title: string
  author: string
  filename: string
}

export default function ReadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Annotation state
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
  const inputRef = useRef<HTMLInputElement>(null)

  const setViewRef = useReaderStore((s) => s.setViewRef)
  const setLocation = useReaderStore((s) => s.setLocation)
  const setTitleStore = useReaderStore((s) => s.setTitle)

  const filename = file?.name ?? null
  const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false
  const { lastLocation, saveProgress } = useProgress(filename)

  // Book ID for annotations
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
    fetch('/data/books.json')
      .then((res) => res.json())
      .then((data) => {
        setBooks(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load books:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    document.title = file ? `${title} - Foliate Reader` : 'Foliate Reader'
  }, [title, file])

  useEffect(() => {
    if (title) setTitleStore(title)
  }, [title, setTitleStore])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setTitle(f.name.replace(/\.(epub|pdf)$/i, ''))
  }, [])

  const handleOpen = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleOpenBook = useCallback(async (book: Book) => {
    try {
      const response = await fetch(`/data/${encodeURI(book.filename)}`)
      const blob = await response.blob()
      const f = new File([blob], book.filename, { type: blob.type })
      setFile(f)
      setTitle(book.title)
    } catch (err) {
      console.error('Failed to open book:', err)
    }
  }, [])

  const handleRelocate = useCallback(
    (loc: unknown) => {
      saveProgress(loc as Parameters<typeof saveProgress>[0])
    },
    [saveProgress]
  )

  // Handle text selection from ReaderView
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
      } else {
        // Don't close if user just clicked - wait for explicit close
      }
    },
    []
  )

  // Handle annotation type selection from toolbar
  const handleSelectType = useCallback(
    async (type: AnnotationType, color: string) => {
      if (!viewRef.current || !toolbarState) return

      const view = viewRef.current
      if (!view) return

      if (isPDF && toolbarState.pageIndex != null && toolbarState.range) {
        // PDF path: direct overlayer rendering with live DOM Range
        const contents = view.renderer.getContents?.() ?? []
        const content = contents.find(c => c.index === toolbarState.pageIndex)
        if (content?.overlayer) {
          const annotation = addAnnotation({
            type,
            color,
            text: toolbarState.text,
            value: toolbarState.pageIndex,
            rects: toolbarState.localRects,
          })
          if (annotation) {
            const drawFn = DRAW_FUNCTIONS[type] ?? Overlayer.highlight
            content.overlayer.add(annotation.id, toolbarState.range, drawFn, { color })
          }
        }
      } else {
        // EPUB path: uses foliate-view's CFI-based system
        const value: string = toolbarState.cfi ?? ''
        addAnnotation({
          type,
          color,
          text: toolbarState.text,
          value,
        })
        if (value) {
          try {
            await view.addAnnotation({ value, type })
          } catch (err) {
            console.error('Failed to add annotation to view:', err)
          }
        }
      }

      setToolbarState(null)
    },
    [toolbarState, addAnnotation, isPDF]
  )

  // Handle add note from toolbar
  const handleAddNote = useCallback(() => {
    if (!toolbarState) return
    setNoteDialogState({
      open: true,
      text: toolbarState.text,
      cfi: toolbarState.cfi,
      pageIndex: toolbarState.pageIndex,
    })
    setToolbarState(null)
  }, [toolbarState])

  // Handle close toolbar
  const handleCloseToolbar = useCallback(() => {
    setToolbarState(null)
  }, [])

  // Handle save note
  const handleSaveNote = useCallback(
    async (note: string) => {
      if (!noteDialogState.text || !viewRef.current) return

      if (isPDF && noteDialogState.pageIndex != null) {
        addAnnotation({
          type: 'highlight',
          color: '#FFEB3B',
          text: noteDialogState.text,
          value: noteDialogState.pageIndex,
          note,
        })
        // Note dialog doesn't have the live Range, so the overlay
        // will be restored via create-overlay with stored rects
      } else {
        const value: string = noteDialogState.cfi ?? ''
        addAnnotation({
          type: 'highlight',
          color: '#FFEB3B',
          text: noteDialogState.text,
          value,
          note,
        })
        if (value) {
          try {
            await viewRef.current.addAnnotation({ value, type: 'highlight' })
          } catch (err) {
            console.error('Failed to add note annotation:', err)
          }
        }
      }

      setNoteDialogState({ open: false, text: '' })
    },
    [noteDialogState, addAnnotation, isPDF]
  )

  // Handle annotation edit (update note)
  const handleAnnotationEdit = useCallback(
    (annotation: { id: string; note?: string; text: string; value?: string | number; rects?: SerializedRect[] }) => {
      setNoteDialogState({
        open: true,
        text: annotation.text,
        cfi: typeof annotation.value === 'number' ? undefined : annotation.value,
        pageIndex: typeof annotation.value === 'number' ? annotation.value : undefined,
        annotationId: annotation.id,
        existingNote: annotation.note,
      })
    },
    []
  )

  // Handle annotation delete
  const handleAnnotationDelete = useCallback(
    (annotation: { id: string; value: string | number; rects?: SerializedRect[] }) => {
      // Remove from view
      if (viewRef.current && annotation.value !== '' && annotation.value != null) {
        if (isPDF && typeof annotation.value === 'number') {
          const contents = viewRef.current.renderer.getContents?.() ?? []
          const content = contents.find(c => c.index === annotation.value)
          content?.overlayer?.remove(annotation.id)
        } else {
          viewRef.current.deleteAnnotation({ value: annotation.value })
        }
      }
      // Remove from store
      deleteAnnotation(annotation.id)
    },
    [deleteAnnotation, isPDF]
  )

  // Handle annotation navigation
  const handleAnnotationNavigate = useCallback(
    async (annotation: Annotation) => {
      if (!viewRef.current || annotation.value === '' || annotation.value == null) return

      if (isPDF && typeof annotation.value === 'number') {
        await viewRef.current.goTo(annotation.value)
        // After navigation, restore overlay from stored rects
        if (annotation.rects) {
          const contents = viewRef.current.renderer.getContents?.() ?? []
          const content = contents.find(c => c.index === annotation.value)
          if (content?.overlayer) {
            const fakeRange = {
              getClientRects: () =>
                annotation.rects!.map(r => new DOMRect(r.left, r.top, r.width, r.height)),
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
        try {
          await viewRef.current.showAnnotation({ value: annotation.value })
        } catch (err) {
          console.error('Failed to navigate to annotation:', err)
        }
      }
    },
    [isPDF]
  )

  if (!file) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-8 p-4'>
        <div className='flex flex-col items-center gap-2 text-center'>
          <BookOpen className='size-16 stroke-[1.5] text-muted-foreground' />
          <h1 className='text-2xl font-bold'>Foliate Reader</h1>
          <p className='text-sm text-muted-foreground'>
            Select a book to read
          </p>
        </div>

        {!loading && books.length > 0 && (
          <div className='grid w-full max-w-lg gap-3'>
            {books.map((book) => (
              <Card
                key={book.id}
                className='flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent'
                onClick={() => handleOpenBook(book)}
              >
                <div className='flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted'>
                  <FileText className='size-5 text-muted-foreground' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{book.title}</p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {book.author}
                  </p>
                </div>
                <span className='text-xs uppercase text-muted-foreground'>
                  {book.filename.endsWith('.pdf') ? 'PDF' : 'EPUB'}
                </span>
              </Card>
            ))}
          </div>
        )}

        <div className='flex flex-col items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            or open a file from your computer
          </span>
          <input
            ref={inputRef}
            type='file'
            accept='.epub,application/epub+zip,.pdf,application/pdf'
            className='hidden'
            onChange={handleFile}
          />
          <Button onClick={handleOpen} size='lg'>
            Open Book
          </Button>
        </div>
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

        <input
          ref={inputRef}
          type='file'
          accept='.epub,application/epub+zip,.pdf,application/pdf'
          className='hidden'
          onChange={handleFile}
        />

        <Button
          variant='ghost'
          size='sm'
          className='ml-auto'
          onClick={handleOpen}
        >
          Open
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
              const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false
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
                  view.addAnnotation({
                    value: ann.value,
                    type: ann.type,
                    color: ann.color,
                  }).catch(() => {})
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

      {/* Annotation Toolbar */}
      {toolbarState && (
        <AnnotationToolbar
          position={toolbarState.position}
          selectedText={toolbarState.text}
          onSelectType={handleSelectType}
          onAddNote={handleAddNote}
          onClose={handleCloseToolbar}
        />
      )}

      {/* Note Dialog */}
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

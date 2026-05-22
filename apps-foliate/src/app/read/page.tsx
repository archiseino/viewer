'use client'

import { useState, useRef, useCallback, useEffect } from "react"
import { ReaderView } from "@/components/ReaderView"
import { ReaderSidebar } from "@/components/ReaderSidebar"
import { SettingsPanel } from "@/components/SettingsPanel"
import { useReaderStore } from "@/store/reader-store"
import { useProgress } from "@/hooks/use-progress"
import { BookOpen, FileText, List, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Book {
  id: string
  title: string
  author: string
  filename: string
}

export default function ReadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setViewRef = useReaderStore((s) => s.setViewRef)
  const setTitleStore = useReaderStore((s) => s.setTitle)

  const filename = file?.name ?? null
  const { lastLocation, saveProgress } = useProgress(filename)

  useEffect(() => {
    fetch("/data/books.json")
      .then(res => res.json())
      .then(data => {
        setBooks(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load books:", err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    document.title = file ? `${title} - Foliate Reader` : "Foliate Reader"
  }, [title, file])

  useEffect(() => {
    if (title) setTitleStore(title)
  }, [title, setTitleStore])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setTitle(f.name.replace(/\.(epub|pdf)$/i, ""))
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
      console.error("Failed to open book:", err)
    }
  }, [])

  const handleRelocate = useCallback((loc: unknown) => {
    saveProgress(loc as Parameters<typeof saveProgress>[0])
  }, [saveProgress])

  if (!file) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="size-16 stroke-[1.5] text-muted-foreground" />
          <h1 className="text-2xl font-bold">Foliate Reader</h1>
          <p className="text-sm text-muted-foreground">
            Select a book to read
          </p>
        </div>

        {!loading && books.length > 0 && (
          <div className="grid w-full max-w-lg gap-3">
            {books.map(book => (
              <Card
                key={book.id}
                className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent"
                onClick={() => handleOpenBook(book)}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                </div>
                <span className="text-xs uppercase text-muted-foreground">
                  {book.filename.endsWith(".pdf") ? "PDF" : "EPUB"}
                </span>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">or open a file from your computer</span>
          <input
            ref={inputRef}
            type="file"
            accept=".epub,application/epub+zip,.pdf,application/pdf"
            className="hidden"
            onChange={handleFile}
          />
          <Button onClick={handleOpen} size="lg">
            Open Book
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <Button variant='ghost' size='sm' onClick={() => setSidebarOpen(true)}>
          <List className='size-4' />
        </Button>
        <span className="truncate text-sm font-medium">{title}</span>

        <input
          ref={inputRef}
          type="file"
          accept=".epub,application/epub+zip,.pdf,application/pdf"
          className="hidden"
          onChange={handleFile}
        />

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={handleOpen}
        >
          Open
        </Button>

        <Button variant='ghost' size='sm' onClick={() => setSettingsOpen(true)}>
          <Settings className='size-4' />
        </Button>
      </header>

      <main className="flex min-h-0 flex-1">
        <ReaderView
          file={file}
          lastLocation={lastLocation ?? undefined}
          onViewReady={(view) => setViewRef(view)}
          onRelocate={handleRelocate}
        />
      </main>

      <ReaderSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

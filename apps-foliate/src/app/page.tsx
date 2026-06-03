'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeSidebar } from '@/components/HomeSidebar'
import { BookCard } from '@/components/BookCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, Plus, MoreHorizontal } from 'lucide-react'

interface Book {
  id: string
  title: string
  author: string
  filename: string
  genre: string
  progress?: number
  status: 'reading' | 'want' | 'finished'
}

const genres = ['All', 'Fiction', 'Classic', 'Fantasy', 'Sci-Fi', 'Non-Fiction', 'Biography']

const books: Book[] = [
  { id: 'crime-and-punishment', title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', filename: 'Crime and Punishment.epub', genre: 'Classic', status: 'want' },
  { id: 'designing-data-intensive-applications', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', filename: 'Designing_Data_Intensive_Applications.pdf', genre: 'Non-Fiction', status: 'want' },
]

export default function HomePage() {
  const router = useRouter()
  const [activeGenre, setActiveGenre] = useState('All')

  const filtered = activeGenre === 'All'
    ? books
    : books.filter((b) => b.genre === activeGenre)

  const reading = filtered.filter((b) => b.status === 'reading')
  const want = filtered.filter((b) => b.status === 'want')
  const finished = filtered.filter((b) => b.status === 'finished')

  const handleBookClick = (book: Book) => {
    router.push(`/reader/${book.id}`)
  }

  return (
    <div className='flex h-screen'>
      <HomeSidebar />
      <main className='flex flex-1 flex-col overflow-hidden'>
        {/* Header */}
        <div className='flex h-14 items-center gap-3 border-b px-6'>
          <div className='relative flex-1 max-w-md'>
            <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input placeholder='Search books...' className='h-9 pl-9' />
          </div>
          <Button size='sm' className='gap-1'>
            <Plus className='size-4' />
            Add
          </Button>
          <Button variant='ghost' size='icon' className='size-9'>
            <MoreHorizontal className='size-4' />
          </Button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-6 py-6'>
          {/* Genre filter pills */}
          <div className='mb-8 flex gap-2'>
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  activeGenre === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Currently Reading */}
          {reading.length > 0 && (
            <section className='mb-8'>
              <h2 className='mb-4 text-lg font-semibold'>Currently Reading</h2>
              <div className='flex gap-4 overflow-x-auto pb-2'>
                {reading.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    author={book.author}
                    progress={book.progress}
                    badge={`${book.progress}%`}
                    onClick={() => handleBookClick(book)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Records count */}
          <p className='mb-6 text-sm text-muted-foreground'>
            Found {filtered.length} record{filtered.length !== 1 ? 's' : ''} available
          </p>

          {/* Want to Read */}
          {want.length > 0 && (
            <section className='mb-8'>
              <h2 className='mb-4 text-lg font-semibold'>Want to Read</h2>
              <div className='flex gap-4 overflow-x-auto pb-2'>
                {want.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    author={book.author}
                    onClick={() => handleBookClick(book)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Finished */}
          {finished.length > 0 && (
            <section>
              <h2 className='mb-4 text-lg font-semibold'>Finished</h2>
              <div className='flex gap-4 overflow-x-auto pb-2'>
                {finished.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    author={book.author}
                    badge='Done'
                    onClick={() => handleBookClick(book)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

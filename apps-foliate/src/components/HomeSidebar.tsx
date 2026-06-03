'use client'

import { cn } from '@/lib/utils'
import { BookOpen, Heart, Clock, LibraryBig, CheckCircle, BookMarked, List } from 'lucide-react'

interface NavItem {
  label: string
  icon: React.ReactNode
  active?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Library',
    items: [
      { label: 'All Books', icon: <BookOpen className='size-4' />, active: true },
      { label: 'Favorites', icon: <Heart className='size-4' /> },
      { label: 'Recent', icon: <Clock className='size-4' /> },
    ],
  },
  {
    title: 'Collections',
    items: [
      { label: 'Fiction', icon: <LibraryBig className='size-4' /> },
      { label: 'Non-Fiction', icon: <LibraryBig className='size-4' /> },
      { label: 'Sci-Fi', icon: <LibraryBig className='size-4' /> },
    ],
  },
  {
    title: 'Reading Status',
    items: [
      { label: 'Currently Reading', icon: <BookMarked className='size-4' /> },
      { label: 'Want to Read', icon: <List className='size-4' /> },
      { label: 'Finished', icon: <CheckCircle className='size-4' /> },
    ],
  },
]

export function HomeSidebar() {
  return (
    <aside className='flex w-60 flex-col border-r bg-background'>
      {/* Brand */}
      <div className='flex h-14 items-center gap-2 border-b px-4'>
        <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
          <BookOpen className='size-4' />
        </div>
        <span className='text-sm font-semibold'>Foliate</span>
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto px-3 py-4'>
        {navSections.map((section) => (
          <div key={section.title} className='mb-6'>
            <p className='mb-2 px-2 text-xs font-medium text-muted-foreground'>
              {section.title}
            </p>
            <div className='space-y-0.5'>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors',
                    item.active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

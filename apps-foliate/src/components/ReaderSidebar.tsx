'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReaderStore } from '@/store/reader-store'
import { cn } from '@/lib/utils'
import { BookOpen, List, Highlighter } from 'lucide-react'
import type { Annotation } from '@/types/annotation'
import '@/types/FoliateView'

interface ReaderSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  annotations?: Annotation[]
  onAnnotationNavigate?: (annotation: Annotation) => void
  onAnnotationEdit?: (annotation: Annotation) => void
  onAnnotationDelete?: (annotation: Annotation) => void
}

export function ReaderSidebar({
  open,
  onOpenChange,
  annotations = [],
  onAnnotationNavigate,
  onAnnotationEdit,
  onAnnotationDelete,
}: ReaderSidebarProps) {
  const viewRef = useReaderStore((s) => s.viewRef)
  const toc = useReaderStore((s) => s.toc)
  const currentLocation = useReaderStore((s) => s.currentLocation)

  const handleTocClick = (href: string) => {
    viewRef?.goTo(href)
    onOpenChange(false)
  }

  const handleFractionChange = ([value]: number[]) => {
    viewRef?.goToFraction(value)
  }

  const handleAnnotationClick = (annotation: Annotation) => {
    // Navigate to annotation location
    if (viewRef) {
      viewRef.showAnnotation(annotation)
    }
    onAnnotationNavigate?.(annotation)
    onOpenChange(false)
  }

  const handleAnnotationEdit = (annotation: Annotation) => {
    onAnnotationEdit?.(annotation)
  }

  const handleAnnotationDelete = (annotation: Annotation) => {
    // Delete from view first
    if (viewRef) {
      viewRef.deleteAnnotation(annotation)
    }
    // Delete from store
    onAnnotationDelete?.(annotation)
  }

  const fraction = currentLocation?.fraction ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='left' className='flex flex-col p-0 w-72 sm:max-w-72'>
        <SheetTitle className='sr-only'>Reader Sidebar</SheetTitle>

        <Tabs defaultValue='contents' className='flex flex-col h-full'>
          <TabsList className='w-full justify-start rounded-none border-b px-2 pt-2'>
            <TabsTrigger value='contents' className='flex items-center gap-1.5'>
              <List className='h-4 w-4' />
              Contents
            </TabsTrigger>
            <TabsTrigger value='annotations' className='flex items-center gap-1.5'>
              <Highlighter className='h-4 w-4' />
              Annotations
              {annotations.length > 0 && (
                <span className='ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/10'>
                  {annotations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='contents' className='flex-1 flex flex-col m-0 min-h-0'>
            <ScrollArea className='flex-1 px-4 py-4 min-h-0'>
              <nav className='space-y-0.5'>
                {toc?.map((item, i) => (
                  <TocItem
                    key={i}
                    item={item}
                    depth={0}
                    activeLabel={currentLocation?.tocItem?.label}
                    onClick={handleTocClick}
                  />
                ))}
                {!toc?.length && (
                  <p className='text-sm text-muted-foreground text-center py-8'>
                    No table of contents
                  </p>
                )}
              </nav>
            </ScrollArea>

            <div className='border-t p-4 space-y-2'>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <BookOpen className='size-3.5' />
                <span>
                  Section {currentLocation?.section.current ?? 0} of{' '}
                  {currentLocation?.section.total ?? 0}
                </span>
              </div>
              <Slider
                value={[fraction]}
                min={0}
                max={1}
                step={0.001}
                onValueChange={handleFractionChange}
              />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>{Math.round(fraction * 100)}%</span>
                <span>Location {currentLocation?.location.current ?? 0}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='annotations' className='flex-1 flex flex-col m-0 min-h-0'>
            <AnnotationsList
              annotations={annotations}
              onNavigate={handleAnnotationClick}
              onEdit={handleAnnotationEdit}
              onDelete={handleAnnotationDelete}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function AnnotationsList({
  annotations,
  onNavigate,
  onEdit,
  onDelete,
}: {
  annotations: Annotation[]
  onNavigate: (a: Annotation) => void
  onEdit: (a: Annotation) => void
  onDelete: (a: Annotation) => void
}) {
  const [filterType, setFilterType] = useState<string>('all')
  const [showNotesOnly, setShowNotesOnly] = useState(false)

  const filteredAnnotations = annotations.filter((ann) => {
    const matchesType = filterType === 'all' || ann.type === filterType
    const matchesNote = !showNotesOnly || (ann.note && ann.note.trim().length > 0)
    return matchesType && matchesNote
  })

  const annotationsWithNotes = annotations.filter(
    (a) => a.note && a.note.trim().length > 0
  ).length

  if (annotations.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-center p-6'>
        <Highlighter className='h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>No annotations yet</p>
        <p className='text-xs text-muted-foreground mt-1'>
          Select text in the book to create highlights
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Filters */}
      <div className='p-3 border-b space-y-2'>
        <div className='flex flex-wrap gap-1'>
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'h-7 px-2 text-xs rounded-md transition-colors',
              filterType === 'all'
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            All ({annotations.length})
          </button>
          {(['highlight', 'underline', 'strikethrough', 'squiggly', 'outline'] as const).map(
            (type) => {
              const count = annotations.filter((a) => a.type === type).length
              if (count === 0) return null
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'h-7 px-2 text-xs rounded-md transition-colors',
                    filterType === type
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {type} ({count})
                </button>
              )
            }
          )}
        </div>

        <button
          onClick={() => setShowNotesOnly(!showNotesOnly)}
          className={cn(
            'h-7 px-2 text-xs rounded-md transition-colors flex items-center gap-1',
            showNotesOnly
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <span className='opacity-50'>📝</span>
          With notes ({annotationsWithNotes})
        </button>
      </div>

      {/* List */}
      <ScrollArea className='flex-1 min-h-0'>
        <div className='p-2 space-y-2'>
          {filteredAnnotations.map((annotation) => (
            <AnnotationItem
              key={annotation.id}
              annotation={annotation}
              onNavigate={() => onNavigate(annotation)}
              onEdit={() => onEdit(annotation)}
              onDelete={() => onDelete(annotation)}
            />
          ))}

          {filteredAnnotations.length === 0 && (
            <div className='text-center py-4 text-sm text-muted-foreground'>
              No annotations match the current filter
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface AnnotationItemProps {
  annotation: Annotation
  onNavigate: () => void
  onEdit: () => void
  onDelete: () => void
}

function AnnotationItem({ annotation, onNavigate, onEdit, onDelete }: AnnotationItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit()
  }

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        'group relative'
      )}
      onClick={onNavigate}
    >
      {/* Color indicator + Type */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <div
            className='w-3 h-3 rounded-full flex-shrink-0'
            style={{ backgroundColor: annotation.color }}
          />
          <span className='text-xs text-muted-foreground capitalize'>
            {annotation.type}
          </span>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
          <button
            onClick={handleEdit}
            className='p-1 rounded hover:bg-accent'
            title='Edit note'
          >
            <span className='text-xs'>✏️</span>
          </button>
          <button
            onClick={handleDelete}
            className='p-1 rounded hover:bg-destructive/10 text-destructive'
            title='Delete'
          >
            <span className='text-xs'>🗑️</span>
          </button>
        </div>
      </div>

      {/* Selected text */}
      <p className='mt-2 text-sm line-clamp-2'>&ldquo;{annotation.text}&rdquo;</p>

      {/* Note preview */}
      {annotation.note && (
        <div className='mt-2 p-2 bg-muted/50 rounded text-xs'>
          <span className='opacity-50 mr-1'>📝</span>
          <span className='line-clamp-2'>{annotation.note}</span>
        </div>
      )}

      {/* Date */}
      <div className='mt-2 text-xs text-muted-foreground'>
        {new Date(annotation.createdAt).toLocaleDateString()}
      </div>
    </div>
  )
}

function TocItem({
  item,
  depth,
  activeLabel,
  onClick,
}: {
  item: { label: string; href?: string; subitems?: { label: string; href?: string }[] }
  depth: number
  activeLabel?: string
  onClick: (href: string) => void
}) {
  const isActive = item.label === activeLabel
  return (
    <div>
      <button
        onClick={() => item.href && onClick(item.href)}
        className={cn(
          'w-full text-left text-sm rounded px-2 py-1 transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent font-medium text-accent-foreground',
          depth > 0 && 'ml-4'
        )}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub, i) => (
        <TocItem
          key={i}
          item={sub}
          depth={depth + 1}
          activeLabel={activeLabel}
          onClick={onClick}
        />
      ))}
    </div>
  )
}
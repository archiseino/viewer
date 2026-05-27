'use client'

import { useMemo, useState } from 'react'
import type { Annotation, AnnotationType } from '@/types/annotation'
import { truncateText } from '@/types/annotation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Trash2,
  Edit3,
  Highlighter,
  MessageSquare,
} from 'lucide-react'

interface AnnotationListProps {
  annotations: Annotation[]
  onNavigate: (annotation: Annotation) => void
  onEdit: (annotation: Annotation) => void
  onDelete: (annotation: Annotation) => void
}

const TypeLabels: Record<AnnotationType, string> = {
  highlight: 'Highlight',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  squiggly: 'Squiggly',
  outline: 'Outline',
}

const TypeIcons: Record<AnnotationType, React.ReactNode> = {
  highlight: <Highlighter className='h-3 w-3' />,
  underline: <span className='text-xs font-bold underline'>U</span>,
  strikethrough: <span className='text-xs font-bold line-through'>S</span>,
  squiggly: <span className='text-xs font-bold'>~</span>,
  outline: <span className='text-xs font-bold border px-0.5'>[]</span>,
}

export function AnnotationList({
  annotations,
  onNavigate,
  onEdit,
  onDelete,
}: AnnotationListProps) {
  const [filterType, setFilterType] = useState<AnnotationType | 'all'>('all')
  const [showNotesOnly, setShowNotesOnly] = useState(false)

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((ann) => {
      const matchesType = filterType === 'all' || ann.type === filterType
      const matchesNote = !showNotesOnly || (ann.note && ann.note.trim().length > 0)
      return matchesType && matchesNote
    })
  }, [annotations, filterType, showNotesOnly])

  const annotationsWithNotes = useMemo(() => {
    return annotations.filter((a) => a.note && a.note.trim().length > 0).length
  }, [annotations])

  if (annotations.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-center p-6'>
        <div className='text-muted-foreground mb-2'>
          <Highlighter className='h-8 w-8 mx-auto mb-2 opacity-50' />
          <p className='text-sm'>No annotations yet</p>
        </div>
        <p className='text-xs text-muted-foreground'>
          Select text in the book to create highlights and notes
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Filters */}
      <div className='p-3 border-b space-y-2'>
        <div className='flex flex-wrap gap-1'>
          <Button
            variant={filterType === 'all' ? 'secondary' : 'ghost'}
            size='sm'
            onClick={() => setFilterType('all')}
            className='h-7 text-xs'
          >
            All ({annotations.length})
          </Button>
          {(Object.keys(TypeLabels) as AnnotationType[]).map((type) => {
            const count = annotations.filter((a) => a.type === type).length
            return (
              <Button
                key={type}
                variant={filterType === type ? 'secondary' : 'ghost'}
                size='sm'
                onClick={() => setFilterType(type)}
                className='h-7 text-xs'
              >
                {TypeLabels[type]} ({count})
              </Button>
            )
          })}
        </div>

        <Button
          variant={showNotesOnly ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => setShowNotesOnly(!showNotesOnly)}
          className='h-7 text-xs'
        >
          <MessageSquare className='h-3 w-3 mr-1' />
          With notes ({annotationsWithNotes})
        </Button>
      </div>

      {/* List */}
      <ScrollArea className='flex-1'>
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
  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        'group'
      )}
      onClick={onNavigate}
    >
      <div className='flex items-start justify-between gap-2'>
        {/* Color indicator + Type */}
        <div className='flex items-center gap-2'>
          <div
            className='w-3 h-3 rounded-full flex-shrink-0'
            style={{ backgroundColor: annotation.color }}
          />
          <Badge variant='secondary' className='text-xs flex items-center gap-1'>
            {TypeIcons[annotation.type]}
            {TypeLabels[annotation.type]}
          </Badge>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className='h-4 w-4 mr-2' />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className='text-destructive focus:text-destructive'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selected text */}
      <p className='mt-2 text-sm line-clamp-2'>&ldquo;{annotation.text}&rdquo;</p>

      {/* Note preview */}
      {annotation.note && (
        <div className='mt-2 p-2 bg-muted/50 rounded text-xs'>
          <MessageSquare className='h-3 w-3 inline mr-1 opacity-50' />
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
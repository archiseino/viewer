'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface AnnotationNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (note: string) => void
  initialNote?: string
  selectedText?: string
}

export function AnnotationNoteDialog({
  open,
  onOpenChange,
  onSave,
  initialNote = '',
  selectedText,
}: AnnotationNoteDialogProps) {
  const [note, setNote] = useState(initialNote)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  const handleSave = () => {
    onSave(note)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setNote(initialNote)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>

        {/* Selected text for context */}
        {selectedText && (
          <div className='bg-muted/50 rounded-md p-3 text-sm'>
            <span className='text-muted-foreground'>Selected: </span>
            <span className='italic'>&ldquo;{selectedText}&rdquo;</span>
          </div>
        )}

        {/* Edit/Preview tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
          <TabsList className='w-full'>
            <TabsTrigger value='edit' className='flex-1'>
              Edit
            </TabsTrigger>
            <TabsTrigger value='preview' className='flex-1'>
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value='edit' className='mt-2'>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='Write your note here... (Markdown supported)'
              className={cn(
                'w-full h-48 p-3 text-sm resize-none',
                'border rounded-md bg-transparent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'placeholder:text-muted-foreground'
              )}
              autoFocus
            />
            <div className='mt-2 text-xs text-muted-foreground'>
              Supports Markdown: **bold**, *italic*, `code`, [links](url)
            </div>
          </TabsContent>

          <TabsContent value='preview' className='mt-2'>
            <div
              className={cn(
                'h-48 p-3 text-sm overflow-auto rounded-md border',
                'prose prose-sm dark:prose-invert max-w-none',
                'prose-headings:mt-2 prose-headings:mb-1',
                'prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
                'prose-code:bg-muted prose-code:px-1 prose-code:rounded',
                'prose-a:text-primary'
              )}
            >
              {note.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{note}</ReactMarkdown>
              ) : (
                <span className='text-muted-foreground italic'>No content</span>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant='outline' onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
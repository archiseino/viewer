'use client'

import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAnnotationStore, createBookId } from '@/store/annotation-store'
import type { Annotation, AnnotationType, SelectionState } from '@/types/annotation'
import { truncateText } from '@/types/annotation'

interface UseAnnotationsOptions {
  file?: File
  bookId?: string
}

export function useAnnotations(options: UseAnnotationsOptions = {}) {
  const { file, bookId: explicitBookId } = options

  const bookId = useMemo(() => {
    if (explicitBookId) return explicitBookId
    if (file) return createBookId(file)
    return ''
  }, [file, explicitBookId])

  const storeActions = useAnnotationStore(
    useShallow((s) => ({
      addAnnotation: s.addAnnotation,
      updateAnnotation: s.updateAnnotation,
      deleteAnnotation: s.deleteAnnotation,
      getAnnotationById: s.getAnnotationById,
      clearBookAnnotations: s.clearBookAnnotations,
    }))
  )

  const annotations = useAnnotationStore(
    useShallow((s) => s.annotations[bookId] ?? [])
  )

  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => b.createdAt - a.createdAt)
  }, [annotations])

  const annotationsBySection = useMemo(() => {
    const groups: Record<string, Annotation[]> = {}
    for (const annotation of annotations) {
      const section = typeof annotation.value === 'string'
        ? annotation.value.split(':')[1] ?? 'unknown'
        : String(annotation.value)
      if (!groups[section]) groups[section] = []
      groups[section].push(annotation)
    }
    return groups
  }, [annotations])

  const addAnnotation = useCallback(
    (data: Omit<Annotation, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>) => {
      if (!bookId) {
        console.warn('Cannot add annotation: no book ID')
        return null
      }
      return storeActions.addAnnotation(bookId, {
        ...data,
        text: truncateText(data.text),
      })
    },
    [storeActions, bookId]
  )

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Annotation>) => {
      storeActions.updateAnnotation(bookId, id, updates)
    },
    [storeActions, bookId]
  )

  const deleteAnnotation = useCallback(
    (id: string) => {
      storeActions.deleteAnnotation(bookId, id)
    },
    [storeActions, bookId]
  )

  const getAnnotation = useCallback(
    (id: string) => {
      return storeActions.getAnnotationById(bookId, id)
    },
    [storeActions, bookId]
  )

  const clearAllAnnotations = useCallback(() => {
    storeActions.clearBookAnnotations(bookId)
  }, [storeActions, bookId])

  const filterByType = useCallback(
    (type: AnnotationType) => {
      return annotations.filter((a) => a.type === type)
    },
    [annotations]
  )

  const annotationsWithNotes = useMemo(() => {
    return annotations.filter((a) => a.note && a.note.trim().length > 0)
  }, [annotations])

  return {
    bookId,
    annotations,
    sortedAnnotations,
    annotationsBySection,
    annotationsWithNotes,

    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getAnnotation,
    clearAllAnnotations,
    filterByType,
  }
}

export function useTextSelection() {
  const getSelectionState = useCallback((): SelectionState | null => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null
    }

    const text = selection.toString().trim()
    const range = selection.getRangeAt(0)
    const rects = Array.from(range.getClientRects())

    if (rects.length === 0) return null

    const bounds: DOMRect = rects.reduce(
      (acc, rect) => {
        return new DOMRect(
          Math.min(acc.x, rect.x),
          Math.min(acc.y, rect.y),
          Math.max(acc.right, rect.right) - Math.min(acc.left, rect.left),
          Math.max(acc.bottom, rect.bottom) - Math.min(acc.top, rect.top)
        )
      },
      new DOMRect(rects[0].x, rects[0].y, rects[0].width, rects[0].height)
    )

    return {
      text,
      rects,
      location: { cfi: '' },
      bounds,
    }
  }, [])

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
  }, [])

  return {
    getSelectionState,
    clearSelection,
  }
}

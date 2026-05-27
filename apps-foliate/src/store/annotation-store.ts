'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Annotation } from '@/types/annotation'
import { generateAnnotationId } from '@/types/annotation'

interface AnnotationStore {
  // Storage: bookId -> annotations array
  annotations: Record<string, Annotation[]>

  // Actions
  addAnnotation: (
    bookId: string,
    data: Omit<Annotation, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>
  ) => Annotation
  updateAnnotation: (bookId: string, id: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (bookId: string, id: string) => void
  getAnnotations: (bookId: string) => Annotation[]
  clearBookAnnotations: (bookId: string) => void
  getAnnotationById: (bookId: string, id: string) => Annotation | undefined
}

export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set, get) => ({
      // Initialize empty annotations map
      annotations: {},

      addAnnotation: (bookId, data) => {
        const now = Date.now()
        const annotation: Annotation = {
          ...data,
          bookId,
          id: generateAnnotationId(),
          createdAt: now,
          updatedAt: now,
        }

        set((state) => {
          const bookAnnotations = state.annotations[bookId] ?? []
          return {
            annotations: {
              ...state.annotations,
              [bookId]: [...bookAnnotations, annotation],
            },
          }
        })

        return annotation
      },

      updateAnnotation: (bookId, id, updates) => {
        set((state) => {
          const bookAnnotations = state.annotations[bookId] ?? []
          const index = bookAnnotations.findIndex((a) => a.id === id)

          if (index === -1) return state

          const updated = {
            ...bookAnnotations[index],
            ...updates,
            updatedAt: Date.now(),
          }

          const newAnnotations = [...bookAnnotations]
          newAnnotations[index] = updated

          return {
            annotations: {
              ...state.annotations,
              [bookId]: newAnnotations,
            },
          }
        })
      },

      deleteAnnotation: (bookId, id) => {
        set((state) => {
          const bookAnnotations = state.annotations[bookId] ?? []
          return {
            annotations: {
              ...state.annotations,
              [bookId]: bookAnnotations.filter((a) => a.id !== id),
            },
          }
        })
      },

      getAnnotations: (bookId) => {
        return get().annotations[bookId] ?? []
      },

      clearBookAnnotations: (bookId) => {
        set((state) => {
          const { [bookId]: _, ...rest } = state.annotations
          return { annotations: rest }
        })
      },

      getAnnotationById: (bookId, id) => {
        const bookAnnotations = get().annotations[bookId] ?? []
        return bookAnnotations.find((a) => a.id === id)
      },
    }),
    {
      name: 'foliate-annotations', // localStorage key
    }
  )
)

// Helper to create a book ID from file
export function createBookId(file: File): string {
  return file.name
}
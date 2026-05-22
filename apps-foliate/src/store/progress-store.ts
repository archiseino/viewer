import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LocationData } from '@/types/reader'

interface ProgressState {
  books: Record<string, LocationData>
}

interface ProgressActions {
  saveProgress: (filename: string, data: LocationData) => void
  loadProgress: (filename: string) => LocationData | null
  clearProgress: (filename: string) => void
}

type ProgressStore = ProgressState & ProgressActions

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      books: {},
      saveProgress: (filename, data) =>
        set((state) => ({
          books: { ...state.books, [filename]: data },
        })),
      loadProgress: (filename) => get().books[filename] ?? null,
      clearProgress: (filename) =>
        set((state) => {
          const { [filename]: _, ...rest } = state.books
          return { books: rest }
        }),
    }),
    { name: 'foliate-progress' }
  )
)

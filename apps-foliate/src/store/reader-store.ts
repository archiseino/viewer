import { create } from 'zustand'
import type { LocationData, TocItem } from '@/types/reader'
import '@/types/FoliateView'

interface ReaderState {
  file: File | null
  title: string
  currentLocation: LocationData | null
  toc: TocItem[] | null
  viewRef: FoliateView | null
}

interface ReaderActions {
  setFile: (file: File | null) => void
  setTitle: (title: string) => void
  setLocation: (loc: LocationData | null) => void
  setToc: (toc: TocItem[]) => void
  setViewRef: (ref: FoliateView | null) => void
  resetReader: () => void
}

type ReaderStore = ReaderState & ReaderActions

export const useReaderStore = create<ReaderStore>()((set) => ({
  file: null,
  title: '',
  currentLocation: null,
  toc: null,
  viewRef: null,
  setFile: (file) => set({ file }),
  setTitle: (title) => set({ title }),
  setLocation: (loc) => set({ currentLocation: loc }),
  setToc: (toc) => set({ toc }),
  setViewRef: (ref) => set({ viewRef: ref }),
  resetReader: () =>
    set({ file: null, title: '', currentLocation: null, toc: null, viewRef: null }),
}))

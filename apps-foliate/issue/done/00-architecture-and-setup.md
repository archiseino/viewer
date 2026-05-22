# Architecture & Setup

## Dependency

Add `zustand` to `apps-foliate/package.json`:

```json
"dependencies": {
  "zustand": "^5"
}
```

## Directory Structure Created

```
src/
  store/              # Zustand — pure state, persist middleware
    settings-store.ts
    progress-store.ts
    reader-store.ts
  hooks/              # React hooks — wire stores into component lifecycle
    use-progress.ts
    use-reader-events.ts
  context/            # React context — DOM-level side effects
    ThemeProvider.tsx
  services/           # Non-React modules — pure logic, DOM manipulation
    theme-css.ts
  components/         # Modified + new
    ReaderView.tsx         (modified — integrates stores + events)
    ReaderSidebar.tsx      (new)
    SettingsPanel.tsx      (new)
  app/
    layout.tsx             (modified — wrap with ThemeProvider)
    read/page.tsx          (modified — orchestrate all pieces)
```

---

## Store Definitions

### `store/settings-store.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ColorScheme = 'light' | 'dark' | 'sepia' | 'system'

interface SettingsState {
  colorScheme: ColorScheme
  fontFamily: string
  fontSize: number       // percentage, 75–175
  margins: number        // px, 8–48
  lineHeight: number     // unitless, 1.2–2.2
}

interface SettingsActions {
  updateSettings: (partial: Partial<SettingsState>) => void
  resetSettings: () => void
}

type SettingsStore = SettingsState & SettingsActions

const defaults: SettingsState = {
  colorScheme: 'system',
  fontFamily: 'system-ui',
  fontSize: 100,
  margins: 16,
  lineHeight: 1.5,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      updateSettings: (partial) => set(partial),
      resetSettings: () => set(defaults),
    }),
    { name: 'foliate-settings' }
  )
)
```

### `store/progress-store.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProgressData {
  fraction: number
  cfi?: string
  section: { current: number; total: number }
  location: { current: number; next: number; total: number }
  tocItem?: { label: string; href: string }
}

interface ProgressState {
  books: Record<string, ProgressData>
}

interface ProgressActions {
  saveProgress: (filename: string, data: ProgressData) => void
  loadProgress: (filename: string) => ProgressData | null
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
```

### `store/reader-store.ts`

```ts
import { create } from 'zustand'

interface LocationData {
  fraction: number
  section: { current: number; total: number }
  location: { current: number; next: number; total: number }
  cfi?: string
  tocItem?: { label: string; href: string }
}

interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}

declare global {
  interface FoliateView extends HTMLElement {
    open: (file: File) => Promise<void>
    init: (opts?: { lastLocation?: unknown; showTextStart?: boolean }) => Promise<void>
    close: () => void
    next: (distance?: number) => Promise<void>
    prev: (distance?: number) => Promise<void>
    goTo: (target: unknown) => Promise<unknown>
    goToFraction: (frac: number) => Promise<void>
    book: { toc?: TocItem[]; metadata?: { title?: string } }
    lastLocation: LocationData | null
  }
}

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
```

`FoliateView` is declared globally so any component can reference the type without imports.

---

## Hooks

### `hooks/use-progress.ts`

Debounces saves so rapid `relocate` events don't thrash localStorage. Reads saved location once on mount.

```ts
'use client'

import { useCallback, useMemo } from 'react'
import { debounce } from '@/lib/debounce'
import { useProgressStore } from '@/store/progress-store'
import type { LocationData } from '@/store/reader-store'

export function useProgress(filename: string | null) {
  const saveProgress = useProgressStore((s) => s.saveProgress)
  const loadProgress = useProgressStore((s) => s.loadProgress)

  const lastLocation = filename ? loadProgress(filename) : null

  const debouncedSave = useMemo(
    () =>
      debounce((data: LocationData) => {
        if (filename) saveProgress(filename, data)
      }, 1000),
    [filename, saveProgress]
  )

  const save = useCallback(
    (data: LocationData) => {
      debouncedSave(data)
    },
    [debouncedSave]
  )

  return { lastLocation, saveProgress: save }
}
```

Need a tiny `src/lib/debounce.ts`:

```ts
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

### `hooks/use-reader-events.ts`

Attaches `relocate` + `load` listeners to the foliate-view element. Runs whenever the view ref changes.

```ts
'use client'

import { useEffect } from 'react'
import { useReaderStore } from '@/store/reader-store'
import { useSettingsStore } from '@/store/settings-store'
import { injectTheme } from '@/services/theme-css'
import type { FoliateView } from '@/store/reader-store'

export function useReaderEvents(
  view: FoliateView | null,
  onRelocate?: (loc: unknown) => void,
  filename?: string
) {
  const setLocation = useReaderStore((s) => s.setLocation)
  const setToc = useReaderStore((s) => s.setToc)
  const settings = useSettingsStore((s) => ({
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    margins: s.margins,
    lineHeight: s.lineHeight,
  }))

  useEffect(() => {
    if (!view) return

    const handleRelocate = (e: CustomEvent) => {
      const detail = e.detail
      // Strip DOM range before storing (can't serialize)
      const { range: _, ...location } = detail
      setLocation(location)
      onRelocate?.(location)
    }

    const handleLoad = (e: CustomEvent) => {
      const doc = e.detail.doc as Document
      if (doc) injectTheme(doc, settings)
    }

    view.addEventListener('relocate', handleRelocate as EventListener)
    view.addEventListener('load', handleLoad as EventListener)

    // Capture TOC
    if (view.book?.toc) setToc(view.book.toc)

    return () => {
      view.removeEventListener('relocate', handleRelocate as EventListener)
      view.removeEventListener('load', handleLoad as EventListener)
    }
  }, [view, settings])
  // Note: settings in deps ensures re-injection when user changes theme
}
```

---

## Context

### `context/ThemeProvider.tsx`

Wraps the app to toggle `.dark` and CSS variables based on `colorScheme`.

```tsx
'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme)

  useEffect(() => {
    const root = document.documentElement

    const apply = (scheme: string) => {
      root.classList.remove('dark', 'sepia')
      if (scheme === 'dark') root.classList.add('dark')
      if (scheme === 'sepia') {
        root.style.setProperty('--background', '#f5f0e8')
        root.style.setProperty('--foreground', '#5c4a3a')
      } else {
        root.style.removeProperty('--background')
        root.style.removeProperty('--foreground')
      }
    }

    if (colorScheme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply(mq.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      handler()
      return () => mq.removeEventListener('change', handler)
    }

    apply(colorScheme)
  }, [colorScheme])

  return <>{children}</>
}
```

---

## Services

### `services/theme-css.ts`

Injects or updates a `<style id="foliate-theme">` in an EPUB iframe document.

```ts
interface ThemeSettings {
  fontFamily: string
  fontSize: number
  margins: number
  lineHeight: number
}

const STYLE_ID = 'foliate-theme'

export function injectTheme(doc: Document, settings: ThemeSettings) {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    doc.head?.appendChild(style)
  }
  style.textContent = css(settings)
}

export function updateAllThemes(
  settings: ThemeSettings,
  getContents: () => { doc?: Document }[]
) {
  for (const { doc } of getContents()) {
    if (doc) injectTheme(doc, settings)
  }
}

function css(s: ThemeSettings) {
  return `
    :root {
      --font-family: ${s.fontFamily};
      --font-size: ${s.fontSize}%;
      --margin: ${s.margins}px;
      --line-height: ${s.lineHeight};
    }
    body {
      font-family: var(--font-family) !important;
      font-size: var(--font-size) !important;
      line-height: var(--line-height) !important;
      padding: var(--margin) !important;
    }
  `
}
```

---

## Modified Files

### `src/app/layout.tsx`

Add `ThemeProvider` wrapper.

```tsx
import type { Metadata } from 'next'
import '@/styles/globals.css'
import { ThemeProvider } from '@/context/ThemeProvider'

export const metadata: Metadata = { title: 'Foliate Reader' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='min-h-screen'>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

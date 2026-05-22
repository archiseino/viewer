import type { TocItem, LocationData } from './reader'

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
    renderer: { getContents?: () => { doc?: Document }[] }
  }
}

export interface LocationData {
  fraction: number
  section: { current: number; total: number }
  location: { current: number; next: number; total: number }
  cfi?: string
  tocItem?: { label: string; href: string }
}

export interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}

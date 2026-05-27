export type AnnotationType = 'highlight' | 'underline' | 'strikethrough' | 'squiggly' | 'outline'

// EPUB uses CFI (EPUB Canonical Fragment Identifier) for precise navigation
export interface EPUBLocation {
  cfi: string
}

// PDF uses page index and bounding rects
export interface PDFLocation {
  page: number // 0-based page index
  rects: { left: number; top: number; right: number; bottom: number }[]
}

export interface Annotation {
  id: string
  bookId: string // unique book identifier (file name or hash)
  type: AnnotationType
  color: string // hex color for the highlight
  value: string // serialized location (CFI for EPUB, JSON for PDF)
  text: string // selected text excerpt (for preview)
  note?: string // markdown note content
  createdAt: number // timestamp
  updatedAt: number // timestamp
}

// Selection state for the toolbar
export interface SelectionState {
  text: string
  rects: DOMRect[]
  location: EPUBLocation | PDFLocation
  bounds: DOMRect // for positioning the toolbar
}

// Color presets for quick selection
export const DEFAULT_COLORS = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Pink', value: '#E91E63' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Purple', value: '#9C27B0' },
  { name: 'Red', value: '#F44336' },
  { name: 'Teal', value: '#009688' },
]

// Helper to generate unique annotation ID
export function generateAnnotationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// Helper to serialize PDF location to string
export function serializePDFLocation(location: PDFLocation): string {
  return JSON.stringify(location)
}

// Helper to deserialize PDF location from string
export function deserializePDFLocation(value: string): PDFLocation | null {
  try {
    return JSON.parse(value) as PDFLocation
  } catch {
    return null
  }
}

// Check if value is a CFI (EPUB) or PDF location
export function isEPUBLocation(value: string): boolean {
  // CFI starts with 'epubcfi://'
  return value.startsWith('epubcfi://')
}

// Helper to extract text excerpt (truncate to max length)
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
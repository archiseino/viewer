# Phase 5: Annotation Store & Highlighting

**Goal:** Users can highlight text, add markdown notes, and persist annotations across sessions for both EPUB and PDF.

Expected output:
- On text selection: popup shows with annotation options
- Support for both PDF and EPUB text selection
- On selection show the default static method on Overlayer.js (underline, strikethrough, squiggly, highlight, outline) with option to add markdown note
- Sidebar menu showing annotations with navigation to location

---

## Architecture Overview

### EPUB vs PDF Selection Handling

| Aspect | EPUB | PDF |
|--------|------|-----|
| Text Source | DOM (HTML iframe) | pdf.js TextLayer (iframe) |
| Selection API | `iframeDoc.defaultView.getSelection()` + Range | Same API (text nodes in DOM) |
| Location Format | CFI (EPUB CFI) | `{page, rects: [{left,top,right,bottom}]}` |
| Overlayer | SVG Overlayer.js | Same Overlayer.js (DOM rects) |
| Events | `draw-annotation`, `show-annotation` | Same events |

**Key Insight:** Both EPUB and PDF content is rendered inside **iframes** within a **closed Shadow DOM** (`foliate-view`, `foliate-paginator`, `foliate-fxl` all use `attachShadow({ mode: 'closed' })`). This means:
- `view.shadowRoot` is `null` — cannot traverse or inject scripts
- `window.getSelection()` on the **main document** cannot see selections inside iframes
- Text selection must be detected using the document exposed through `foliate-view`'s public API

### Text Detection Approach

Instead of injecting scripts into iframes (blocked by closed shadow DOM) or using `postMessage`:

1. **Hook into `foliate-view`'s `load` event** — the event passes `e.detail.doc` (the content document inside the iframe)
2. **Attach `mouseup`/`touchend` listeners directly** on the content `doc`
3. **Use `doc.defaultView.getSelection()`** — this reads selection inside the iframe (unlike main document's `window.getSelection()`)
4. **Use `doc.defaultView.frameElement.getBoundingClientRect()`** — `frameElement` is the correct way to get the iframe element from its content document
5. No shadow DOM access, no polling, no `postMessage`

---

## Implementation Plan

### Phase 5A: Core Infrastructure

#### 1. Type Definitions
**File:** `src/types/annotation.ts`

```typescript
export type AnnotationType = 'highlight' | 'underline' | 'strikethrough' | 'squiggly' | 'outline'

export interface EPUBLocation {
  cfi: string // EPUB CFI for precise navigation
}

export interface PDFLocation {
  page: number // 0-based page index
  rects: { left: number; top: number; right: number; bottom: number }[] // bounding rects
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

export interface AnnotationSelection {
  text: string
  rects: DOMRect[]
  location: EPUBLocation | PDFLocation
}
```

#### 2. Annotation Store
**File:** `src/store/annotation-store.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Annotation, AnnotationType } from '@/types/annotation'

interface AnnotationStore {
  // State
  annotations: Map<string, Annotation[]> // bookId -> annotations

  // Actions
  addAnnotation: (bookId: string, annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Annotation
  updateAnnotation: (bookId: string, id: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (bookId: string, id: string) => void
  getAnnotations: (bookId: string) => Annotation[]
  clearBookAnnotations: (bookId: string) => void
}
```

**Storage:** Use Zustand with `persist` middleware → localStorage (MVP)
- Abstract interface for easy IndexedDB migration later
- Structure: `localStorage.setItem('foliate-annotations', JSON.stringify({...}))`

#### 3. Annotation Hook
**File:** `src/hooks/use-annotations.ts`

```typescript
export function useAnnotations(bookId: string) {
  // Returns annotations for current book
  // Methods to add/update/delete
  // Selection handling helpers
}
```

---

### Phase 5B: PDF.js Modifications

**File:** `packages/foliate-js/pdf.js`

Add text selection detection (lines ~55-65):

```javascript
// In render() function, after textLayer.render()
// Enable text selection detection
container.onpointerup = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
        const rects = Array.from(selection.getRangeAt(0).getClientRects())
        // Store for retrieval by View class
    }
}
```

**Changes needed:** ~15-20 lines to emit selection events

---

### Phase 5C: View Integration

**File:** `src/components/ReaderView.tsx`

**Key changes:**
- Remove `setInterval`-based iframe polling (`injectIframeScripts`)
- Remove `FOLIATE_TEXT_SELECTION` postMessage handler
- Attach selection listeners directly to content documents via `foliate-view`'s API

**File:** `src/hooks/use-reader-events.ts`

Attach selection detection on the content `doc` when the `load` event fires:

```typescript
const handleLoad = (e: CustomEvent) => {
  const doc = e.detail.doc as Document
  if (doc) {
    injectTheme(doc, settings)
    attachSelectionListener(doc, onTextSelection)
  }
}
```

```typescript
function attachSelectionListener(
  doc: Document,
  onTextSelection?: (state: { text: string; rects: DOMRect[]; bounds: DOMRect } | null) => void
) {
  const handler = () => {
    const sel = doc.defaultView?.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const range = sel.getRangeAt(0)
    const rects = Array.from(range.getClientRects())
    if (rects.length === 0) return

    // Convert iframe coordinates to viewport coordinates
    const iframe = doc.defaultView?.frameElement as HTMLElement | null
    if (!iframe) return
    const iframeRect = iframe.getBoundingClientRect()
    const viewportRects = rects.map(r => new DOMRect(
      r.x + iframeRect.left,
      r.y + iframeRect.top,
      r.width,
      r.height
    ))

    const minX = Math.min(...viewportRects.map(r => r.x))
    const minY = Math.min(...viewportRects.map(r => r.y))
    const maxRight = Math.max(...viewportRects.map(r => r.right))
    const maxBottom = Math.max(...viewportRects.map(r => r.bottom))
    const bounds = new DOMRect(minX, minY, maxRight - minX, maxBottom - minY)

    onTextSelection?.({ text, rects: viewportRects, bounds })
  }

  doc.addEventListener('mouseup', handler)
  doc.addEventListener('touchend', handler)
}
```

**File:** `src/components/ReaderView.tsx`

Remove these deprecated approaches:
- `injectIframeScripts()` function and its `setInterval` polling
- `FOLIATE_TEXT_SELECTION` `message` event listener
- Document-level `mouseup`/`touchend` listener using `window.getSelection()`

Keep the `load` event listener (now in `use-reader-events.ts`) and the keyboard navigation handler.

**Flow:**
```
User selects text in iframe →
  doc.mouseup fires (attached via load event) →
    doc.defaultView.getSelection() (reads selection inside iframe) →
      doc.defaultView.frameElement.getBoundingClientRect() (coordinate conversion) →
        onTextSelection callback →
          Show AnnotationToolbar popup →
            User picks type + color + optional note →
              Store.save() + View.addAnnotation()
```

---

### Phase 5D: UI Components

#### 1. AnnotationToolbar
**File:** `src/components/AnnotationToolbar.tsx`

- Popup that appears near selection
- Type buttons: highlight, underline, strikethrough, squiggly, outline
- Color picker (full spectrum, not predefined)
- "Add Note" button
- Position: absolute, calculated from selection rects

```tsx
interface AnnotationToolbarProps {
  position: { x: number; y: number }
  onSelectType: (type: AnnotationType, color: string) => void
  onClose: () => void
}
```

#### 2. AnnotationNoteDialog
**File:** `src/components/AnnotationNoteDialog.tsx`

- Dialog with markdown editor
- Preview mode
- Save/Cancel buttons

#### 3. AnnotationList (Sidebar)
**File:** `src/components/AnnotationList.tsx`

- Tab in ReaderSidebar
- List of annotations grouped by page/section
- Click to navigate to location
- Edit/Delete actions
- Filter by type

---

### Phase 5E: foliate-js/view.js Integration

**No major changes needed** - view.js already has:

```javascript
addAnnotation(annotation, remove) // line 368
deleteAnnotation(annotation)     // line 399
showAnnotation(annotation)        // line 421
```

**What the app needs to do:**
1. Call `view.addAnnotation({value: cfiOrLocation, type, color})` after saving to store
2. Listen to `show-annotation` event to navigate when user clicks annotation
3. Pass the `draw` function (from `Overlayer.outline`, etc.) to render styles

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/annotation.ts` | Create | Type definitions |
| `src/store/annotation-store.ts` | Create | Zustand store with persistence |
| `src/hooks/use-annotations.ts` | Create | Annotation operations hook |
| `src/components/AnnotationToolbar.tsx` | Create | Selection popup UI |
| `src/components/AnnotationNoteDialog.tsx` | Create | Note editor dialog |
| `src/components/AnnotationList.tsx` | Create | Sidebar annotation list |
| `src/components/ReaderView.tsx` | Modify | Remove broken shadow DOM/postMessage selection; keep keyboard nav only |
| `src/components/ReaderSidebar.tsx` | Modify | Add annotations tab |
| `src/hooks/use-reader-events.ts` | Modify | Attach selection listeners on content `doc` via `load` event; handle annotation events |

---

## Known Issue: Closed Shadow DOM Blocks Selection

**Bug discovered during implementation:**
Both `foliate-view` and `foliate-paginator`/`foliate-fxl` use `attachShadow({ mode: 'closed' })`, making `shadowRoot` inaccessible from outside. This breaks the initial approach of injecting selection scripts into iframes.

**Initial (broken) approach:**
- Poll `view.shadowRoot.querySelectorAll('iframe')` every 1s
- Inject a `mouseup` handler script into each iframe via `postMessage`
- Convert coordinates by casting `event.source as HTMLIFrameElement`

**Why it failed:**
1. `shadowRoot` is `null` → script never injected → no postMessage
2. `event.source` is `WindowProxy`, not `HTMLIFrameElement` → `getBoundingClientRect()` throws `TypeError`

**Resolution:**
Use `foliate-view`'s public API instead:
- The `load` custom event exposes `e.detail.doc` — the content document inside the iframe
- `doc.defaultView.getSelection()` reads selections inside the iframe
- `doc.defaultView.frameElement` references the iframe element for coordinate conversion
- No shadow DOM access, no polling, no `postMessage`

---

## Technical Decisions

### 1. Storage: LocalStorage (MVP)

Zustand persist middleware with localStorage.

**Rationale:**
- MVP scope: localStorage is sufficient (< 5MB typical usage)
- Simple implementation, no async complexity
- Easy to migrate to IndexedDB later (abstract behind store interface)

### 2. PDF Position Format

Store bounding rects directly for simplicity:

```typescript
interface PDFLocation {
  page: number // 0-based
  rects: { left: number; top: number; right: number; bottom: number }[]
}
```

Serialized as JSON string in `Annotation.value` field.

**Rationale:**
- Direct rendering without recalculating
- Handles zoom by storing absolute coordinates
- CFI for EPUB (precision), rects for PDF (simplicity)

### 3. Annotation ID Generation

Use `crypto.randomUUID()` or timestamp-based ID:

```typescript
const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
```

### 4. Color Picker

Full spectrum color picker using CSS `<input type="color">` or `react-colorful`.

Default colors:
- Yellow: `#FFEB3B`
- Green: `#4CAF50`
- Blue: `#2196F3`
- Pink: `#E91E63`
- Orange: `#FF9800`

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Action                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Text Selection inside iframe                                   │
│  (EPUB: foliate-paginator iframe ❘ PDF: foliate-fxl iframe)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  doc.mouseup fires (listener attached via load event)           │
│  doc = e.detail.doc from foliate-view "load" custom event       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  doc.defaultView.getSelection() → text + rects                 │
│  doc.defaultView.frameElement.getBoundingClientRect()          │
│  → Convert iframe coords to viewport coords                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  onTextSelection callback → ReaderView passes to ReadPage      │
│  → Show AnnotationToolbar popup near selection                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  User picks type/color  │     │  User clicks "Add Note" │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  annotation-store.addAnnotation()                              │
│  → Generate ID, add timestamps, save to localStorage             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  view.addAnnotation({value, type, color})                        │
│  → Overlayer renders SVG highlight on document                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Annotation appears on page + stored for next session          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Select text in EPUB → toolbar appears
- [ ] Select text in PDF → toolbar appears
- [ ] Navigate to next/previous page → selection listeners still work (load event re-attaches)
- [ ] Change font/size/theme → selection still works (listeners survive doc re-theme)
- [ ] Click highlight → yellow highlight rendered
- [ ] Click color picker → custom color applied
- [ ] Add note → markdown saved and displayed
- [ ] Reload book → annotations restored
- [ ] Click annotation in sidebar → navigates to location
- [ ] Delete annotation → removed from page and storage
- [ ] All 5 types work: highlight, underline, strikethrough, squiggly, outline
- [ ] No console errors about `shadowRoot`, `getBoundingClientRect`, or `postMessage`
- [ ] No `setInterval` running after ReaderView unmounts

---

## Dependencies

No new dependencies needed for MVP:
- Zustand (already installed)
- Tailwind (styling)
- react-markdown (note rendering, already installed)
- Native `<input type="color">` for color picker

---

## Future Considerations (Out of Scope for Phase 5)

1. **IndexedDB migration** - When annotation data grows large
2. **Export/Import** - Backup annotations to file
3. **Sync** - Cloud sync across devices
4. **Search annotations** - Full-text search in notes
5. **PDF-native highlights** - Store as PDF annotation objects (not just overlays)
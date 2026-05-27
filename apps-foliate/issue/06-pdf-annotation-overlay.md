# Phase 6: PDF Annotation Overlay Fix

**Goal:** Fix PDF annotations so text selection creates visible overlays (highlight, underline, etc.) that persist across page changes, zoom, rotation, and reload.

## Current Bug Summary

PDF navigation (`goTo`) works, but visual overlays never render because:

1. `use-reader-events.ts` always generates a CFI string via `view.getCFI()`. PDF's text layer DOM cannot resolve CFI → `anchor(doc)` throws → `range = undefined` → no overlay.
2. `view.addAnnotation({ value: cfiString })` → `resolveNavigation` → `resolveCFI` → `CFI.toRange` fails on PDF text layer → `draw-annotation` never emitted → Overlayer never called.
3. Annotations are stored with `value` as a CFI string. On page change, the same broken path is hit during `restoreAnnotations`.

**Root Cause:** `Overlayer.add()` (`overlayer.js:17`) requires `range.getClientRects()`. For PDF, the CFI-to-DOM-Range resolution always fails, so the range is undefined and the overlay is skipped.

## Solution Architecture

Bypass `foliate-view`'s CFI-based annotation system for PDF. Instead:

- **Store annotations with `value = pageIndex` and page-relative `rects`**
- **At selection time**: render directly on the overlayer using the live DOM Range
- **At restore time**: use a fake-range object returning stored rects
- **At navigate time**: `goTo(pageIndex)`, then re-render highlight from rects

### Flow Diagram

```
Text selected in PDF iframe
  → attachSelectionListener fires
    → Detects foliate-fxl renderer → skips getCFI()
    → Passes localRects (iframe-local coords) + pageIndex to callback
      → page.tsx handleTextSelection stores them in toolbarState
        → User picks type/color
          → handleSelectType:
            1. Store annotation { value: pageIndex, rects: localRects, type, color }
            2. Get overlayer from current page's getContents()
            3. Call overlayer.add(id, selectionRange, drawFn, { color }) ← uses LIVE range
            4. ← Visual overlay appears immediately

PDF page changes / reload
  → create-overlay event fires
    → Restore annotations for this pageIndex
      → For each stored PDF annotation:
        1. Create fakeRange: { getClientRects: () => restoredRects, ... }
        2. Call overlayer.add(id, fakeRange, drawFn, { color })
        3. ← Overlay is restored without CFI resolution

Sidebar annotation click
  → handleAnnotationNavigate:
    1. view.goTo(pageIndex) ← this works
    2. After navigation, restore overlay from stored rects
      (Step reused from restore flow above)
```

## File Changes

### 1. `src/types/annotation.ts` — Add rects field

```typescript
export interface Annotation {
  id: string
  bookId: string
  type: AnnotationType
  color: string
  value: string | number  // CFI for EPUB, pageIndex for PDF
  text: string
  note?: string
  rects?: SerializedRect[]  // NEW: page-relative rects for PDF overlay restore
  createdAt: number
  updatedAt: number
}

export interface SerializedRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}
```

### 2. `src/hooks/use-reader-events.ts` — Skip CFI for PDF, pass local rects

**Detect PDF renderer:**

```typescript
function attachSelectionListener(
  view: FoliateView,
  doc: Document,
  onTextSelection?: (state: {
    text: string
    rects: DOMRect[]
    bounds: DOMRect
    cfi?: string
    pageIndex?: number
    localRects?: SerializedRect[]  // NEW
  } | null) => void
) {
```

**Inside the handler, after getting rects:**

```typescript
// NEW: store iframe-local rects before viewport conversion
const rawRects = Array.from(range.getClientRects())
const localRects = rawRects.map(r => ({
  left: r.left, top: r.top, right: r.right,
  bottom: r.bottom, width: r.width, height: r.height,
}))

// Detect fixed-layout (PDF) renderer
const isPDF = view.renderer?.tagName === 'foliate-fxl'
const cfi = !isPDF && pageIndex != null ? view.getCFI(pageIndex, range) : undefined

onTextSelection?.({ text, rects: viewportRects, bounds, cfi, pageIndex, localRects })
```

### 3. `src/app/read/page.tsx` — Main orchestration changes

#### 3a. Track if current file is PDF

```typescript
const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false
```

#### 3b. Extend toolbarState to include localRects + range

```typescript
const [toolbarState, setToolbarState] = useState<{
  position: { x: number; y: number }
  text: string
  rects: DOMRect[]
  bounds: DOMRect
  cfi?: string
  pageIndex?: number
  localRects?: SerializedRect[]  // NEW
  range?: Range                 // NEW: live Range for immediate PDF overlay
} | null>(null)
```

Pass the live Range through the selection callback:

```typescript
// In handleTextSelection:
setToolbarState({
  position: { x: state.bounds.x, y: state.bounds.y },
  text: state.text,
  rects: state.rects,
  bounds: state.bounds,
  cfi: state.cfi,
  pageIndex: state.pageIndex,
  localRects: state.localRects,
  range: state.cfi ? undefined : selectionRange,  // only pass live Range for PDF
})
```

#### 3c. Rewrite handleSelectType for PDF

```typescript
const handleSelectType = useCallback(
  async (type: AnnotationType, color: string) => {
    if (!viewRef.current || !toolbarState) return

    const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false

    if (isPDF && toolbarState.range && toolbarState.pageIndex != null) {
      // PDF path: direct overlayer rendering
      const contents = viewRef.current.renderer.getContents()
      const content = contents.find(c => c.index === toolbarState.pageIndex)
      if (content?.overlayer) {
        const annotation = addAnnotation({
          type,
          color,
          text: toolbarState.text,
          value: toolbarState.pageIndex,
          rects: toolbarState.localRects,
        })
        if (annotation) {
          const drawFn = DRAW_FUNCTIONS[type] ?? Overlayer.highlight
          content.overlayer.add(annotation.id, toolbarState.range, drawFn, { color })
        }
      }
    } else {
      // EPUB path: uses foliate-view's CFI-based system
      const value: string = toolbarState.cfi ?? ''
      addAnnotation({ type, color, text: toolbarState.text, value })
      if (value) {
        try {
          await viewRef.current.addAnnotation({ value, type })
        } catch (err) {
          console.error('Failed to add annotation to view:', err)
        }
      }
    }

    setToolbarState(null)
  },
  [toolbarState, addAnnotation, file]
)
```

Similarly update `handleSaveNote`.

#### 3d. Update the create-overlay restore handler

In the `onViewReady` callback, replace the current `restoreAnnotations`:

```typescript
const restoreAnnotations = () => {
  for (const ann of annotationsRef.current) {
    if (ann.value === '' || ann.value == null) continue
    const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false

    if (isPDF && ann.rects && typeof ann.value === 'number') {
      // PDF: restore from stored rects
      const contents = view.renderer.getContents()
      const content = contents.find(c => c.index === ann.value)
      if (!content?.overlayer) continue
      const fakeRange = {
        getClientRects: () =>
          ann.rects!.map(r => new DOMRect(r.left, r.top, r.width, r.height)),
        getBoundingClientRect: () => {
          const left = Math.min(...ann.rects!.map(r => r.left))
          const top = Math.min(...ann.rects!.map(r => r.top))
          const right = Math.max(...ann.rects!.map(r => r.right))
          const bottom = Math.max(...ann.rects!.map(r => r.bottom))
          return new DOMRect(left, top, right - left, bottom - top)
        },
      }
      const drawFn = DRAW_FUNCTIONS[ann.type] ?? Overlayer.highlight
      content.overlayer.add(ann.id, fakeRange, drawFn, { color: ann.color })
    } else {
      // EPUB: use foliate-view's annotation system
      view.addAnnotation({
        value: ann.value,
        type: ann.type,
        color: ann.color,
      }).catch(() => {})
    }
  }
}
```

**Important:** The fakeRange approach works because `Overlayer.add()` only calls `range.getClientRects()` (returns iterable → arrays work with `for...of`) and `Overlayer.hitTest()` calls `getClientRects()` + `getBoundingClientRect()` (the latter is only used for hit testing which is optional).

#### 3e. Fix handleAnnotationNavigate for PDF

```typescript
const handleAnnotationNavigate = useCallback(
  async (annotation: Annotation) => {
    if (!viewRef.current || annotation.value === '' || annotation.value == null) return
    const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false

    if (isPDF && typeof annotation.value === 'number') {
      // PDF: goTo page, then restore overlay
      await viewRef.current.goTo(annotation.value)
      // After navigation, re-render overlay
      const contents = viewRef.current.renderer.getContents()
      const content = contents.find(c => c.index === annotation.value)
      if (content?.overlayer && annotation.rects) {
        const fakeRange = {
          getClientRects: () =>
            annotation.rects!.map(r => new DOMRect(r.left, r.top, r.width, r.height)),
          getBoundingClientRect: () => { /* same as above */ },
        }
        const drawFn = DRAW_FUNCTIONS[annotation.type] ?? Overlayer.highlight
        content.overlayer.add(annotation.id, fakeRange, drawFn, { color: annotation.color })
      }
    } else {
      // EPUB: use showAnnotation
      await viewRef.current.showAnnotation({ value: annotation.value })
    }
  },
  [file]
)
```

#### 3f. Fix handleAnnotationDelete for PDF

```typescript
const handleAnnotationDelete = useCallback(
  (annotation: Annotation) => {
    if (viewRef.current && annotation.value !== '' && annotation.value != null) {
      const isPDF = file?.name?.toLowerCase().endsWith('.pdf') ?? false
      if (isPDF && typeof annotation.value === 'number') {
        // PDF: remove from overlayer directly
        const contents = viewRef.current.renderer.getContents()
        const content = contents.find(c => c.index === annotation.value)
        content?.overlayer?.remove(annotation.id)
      } else {
        viewRef.current.deleteAnnotation({ value: annotation.value })
      }
    }
    deleteAnnotation(annotation.id)
  },
  [deleteAnnotation, file]
)
```

### 4. `src/hooks/use-reader-events.ts` — Export localRects type

Add `localRects` to the selection callback type:

```typescript
export interface TextSelectionState {
  text: string
  rects: DOMRect[]
  bounds: DOMRect
  cfi?: string
  pageIndex?: number
  localRects?: SerializedRect[]
}
```

## Edge Cases

| Case | Handling |
|------|----------|
| **PDF zoom change** | `content.overlayer.element` stays in the iframe; client rects are recomputed on `redraw()` if using fakeRange with stored rects. Since rects are page-relative, zoom doesn't change the fractional positions. **But** stored rects are absolute pixels within the iframe, so zoom will misalign them. |
| **PDF rotation** | Same issue as zoom — absolute pixel rects don't scale. Mitigation: store rects as fractions of iframe content dimensions, then convert on restore. |
| **Multiple PDF frames (spread)** | `getContents()` returns up to 3 frames (left/center/right). We check `c.index === pageIndex` to find the right overlayer. |
| **No overlayer on page** | `content?.overlayer` guard prevents crash. |
| **Annotation deleted from sidebar** | We call `content.overlayer.remove(annotation.id)` using the stored `id` as the overlayer key. |
| **Mixed EPUB + PDF (not possible here but defensive)** | `isPDF` check via filename makes it explicit. |

## FakeRange Compatibility

`Overlayer` uses these methods on the range:

- `range.getClientRects()` — returns `DOMRectList` (iterable). An array of `{ left, top, right, bottom, width, height }` works with `for...of` destructuring used in all static draw methods (`highlight`, `underline`, `strikethrough`, `squiggly`, `outline`).
- No other range methods are called by `Overlayer` internals.
- `hitTest()` accesses `obj.rects` directly (cached from `getClientRects()` on add), not from the range.

## Dependencies

No new dependencies. All changes are in existing files.

## Testing Checklist

- [ ] Open PDF → select text → AnnotationToolbar appears at selection
- [ ] Pick highlight → yellow highlight rendered on PDF page
- [ ] Pick underline/strikethrough/squiggly/outline → correct style rendered
- [ ] Change page → annotations on new page visible, old page hidden
- [ ] Go back to annotated page → annotations restored from stored rects
- [ ] Reload book → all PDF annotations restored
- [ ] Click annotation in sidebar → navigates to page + highlights it
- [ ] Delete annotation → removed from page and store
- [ ] PDF zoom → annotations visible (may drift — stretch goal)
- [ ] PDF rotation → annotations visible (may drift — stretch goal)
- [ ] EPUB annotations still work unchanged
- [ ] No console errors about CFI parse failures or `anchor(doc)` exceptions for PDF

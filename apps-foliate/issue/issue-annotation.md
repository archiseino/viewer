# Annotation Bug Trace

## Complete Annotation Flow (Fixed + Remaining Bugs)

### End-to-End Flow

```
User selects text in iframe
  → [FIXED] attachSelectionListener detects it via doc.defaultView.getSelection()
  → [FIXED] Coordinates converted via doc.defaultView.frameElement.getBoundingClientRect()
  → onTextSelection callback fires
    → setToolbarState({ position, text, rects, bounds })
      → AnnotationToolbar renders at (bounds.x, bounds.y - 120)

User picks highlight type + color
  → handleSelectType(type, color)
    1. addAnnotation({ type, color, text: selectedText, value: selectedText })
       → stored to localStorage with WRONG value (text instead of CFI)
    2. viewRef.current.addAnnotation({ value: "{text: ...}", type })
       → [BUG 2] value is placeholder string, not valid CFI/JSON
         → EPUB: resolveNavigation → resolveCFI → CFI parse fail → null
         → PDF:  resolveNavigation → resolveHref → JSON.parse fail → SyntaxError
    3. setToolbarState(null) → toolbar dismissed
```

---
```

```
Could not go to
goTo                  @ view.js:520
await in goTo
showAnnotation        @ view.js:474
handleAnnotationClick @ ReaderSidebar.tsx:47
onNavigate            @ ReaderSidebar.tsx:241
<div>
AnnotationItem        @ ReaderSidebar.tsx:279
<AnnotationItem>
(anonymous)           @ ReaderSidebar.tsx:238
AnnotationsList       @ ReaderSidebar.tsx:237
<AnnotationsList>
ReaderSidebar         @ ReaderSidebar.tsx:133
```

---

## 📄 PDF Annotation Root Cause Analysis

### Architecture Difference: EPUB vs PDF

| Feature | EPUB (Paginator) | PDF (FixedLayout) |
|---|---|---|
| Renderer | `foliate-view` (paginator.js) | `foliate-fxl` (fixed-layout.js) |
| `getContents()` returns | `{ index, overlayer, doc }` | `{ doc }` — **no index, no overlayer** |
| `create-overlayer` event | Dispatched per content view | **Not implemented** |
| Index tracking | Via spine item index | Page numbers via `this.index` |
| Annotation value | CFI string (`epubcfi(...)`) | Not handled |

### Issue 1 — Selection produces empty CFI for PDF

**Chain of failure:**
```
attachSelectionListener (use-reader-events.ts:42-44)
  → view.renderer.getContents()        // [ { doc } ] — no index
  → content.index === undefined
  → view.getCFI(undefined, range)      // crash or undefined return
  → cfi === undefined
  → onTextSelection({ ..., cfi: undefined })
```

**Root cause:** `FixedLayout.getContents()` at `fixed-layout.js:308-313`:
```javascript
getContents() {
    return Array.from(this.#root.querySelectorAll('iframe'), frame => ({
        doc: frame.contentDocument,
        // TODO: index, overlayer
    }))
}
```

`FixedLayout` has its own `this.index` (the current page), but doesn't expose it via `getContents()`.

### Issue 2 — Empty value crashes navigation via JSON.parse

**Chain of failure:**
```
handleSelectType (page.tsx:157)
  → const value = toolbarState.cfi ?? ''   // cfi undefined → ''
  → addAnnotation({ type, color, text, value: '' })
  → view.addAnnotation({ value: '', type })
    → resolveNavigation('')
      → not a number, not a fraction, not a CFI
      → book.resolveHref('')                  // pdf.js:182
        → JSON.parse('')                      // SyntaxError!
```

The `'handleSelectType` writes `''` to localStorage as the annotation `value`. Any click on this annotation triggers the crash.

### Issue 3 — showAnnotation crashes on null overlayer

**`view.js:472-481`:**
```javascript
async showAnnotation(annotation) {
    const { value } = annotation;
    const resolved = await this.goTo(value);      // goTo succeeds (or catches)
    if (resolved) {
        const { index, anchor } = resolved;
        const { doc } = this.#getOverlayer(index); // ← #getOverlayer returns undefined!
        const range = anchor(doc);                  // TypeError: Cannot destructure 'doc'
        this.#emit('show-annotation', { value, index, range });
    }
}
```

`#getOverlayer` at `view.js:448-452`:
```javascript
#getOverlayer(index) {
    return this.renderer
      .getContents()
      .find((x) => x.index === index && x.overlayer);
}
```

For PDF, no content entry satisfies both `x.index === index` (no index) AND `x.overlayer` (no overlayer).
Returns `undefined`. `const { doc } = undefined` throws TypeError.

### Issue 4 — No visual annotation overlays on PDF pages

`addAnnotation` (view.js:431-444) is actually safe — `#getOverlayer` returns undefined → `if (obj)` is falsy → skips silently. But that means **no highlight is ever drawn on PDF pages**.

To support PDF overlays, `FixedLayout` needs:
- An `Overlayer` instance per iframe page
- SVG overlay element positioned on each page
- Coordinate mapping from DOM Range to page-relative positions

---

## 🔧 Proposed Fix Plan

### Phase 1 — Fix annotation creation value for PDF

**Target: `src/hooks/use-reader-events.ts`** `attachSelectionListener`

Pass the PDF page index to the selection callback when `content.index` is undefined:
```typescript
// For PDF (content.index is undefined), get the page index from the renderer
const pdfIndex = content?.index != null
  ? undefined
  : (view.renderer as any)?.index   // FixedLayout has `this.index`
```

Also pass `rects` separately to allow PDFLocation construction.

**Target: `src/app/read/page.tsx`** `handleSelectType`

When `toolbarState.cfi` is undefined (PDF), build value from page index + rects:
```typescript
const value = toolbarState.cfi
  ?? (toolbarState.pdfPage != null
    ? toolbarState.pdfPage    // store page index as a number
    : '')
```

A number value hits `resolveNavigation`'s `typeof target === 'number'` branch → `{ index: target }` → `FixedLayout.goTo` navigates correctly via `book.sections[target]`.

### Phase 2 — Guard showAnnotation against null overlayer

**Target: `packages/foliate-js/view.js`** `showAnnotation`

Guard against null `#getOverlayer`:
```javascript
async showAnnotation(annotation) {
    const { value } = annotation;
    const resolved = await this.goTo(value);
    if (resolved) {
        const { index, anchor } = resolved;
        const over = this.#getOverlayer(index);
        if (over) {
            const { doc } = over;
            const range = anchor(doc);
            this.#emit('show-annotation', { value, index, range });
        } else {
            // PDF — no overlayer available, just navigate
            this.#emit('show-annotation', { value, index });
        }
    }
}
```

### Phase 3 — Implement overlayer support in FixedLayout (future work)

**Target: `packages/foliate-js/fixed-layout.js`**

1. Import `Overlayer` from `overlayer.js`
2. In `getContents()` or during page creation, create `Overlayer` per iframe
3. Dispatch `create-overlayer` events so `view.js` registers overlayers
4. Handle coordinate mapping from DOM Range → iframe-relative positions

This phase requires understanding `FixedLayout`'s page rendering lifecycle and the PDF.js text layer structure.

---

## Dependency Graph

```
read/page.tsx
  ├── useAnnotations hook
  │   └── useAnnotationStore (Zustand + persist → localStorage)
  ├── ReaderView
  │   ├── useReaderEvents
  │   │   └── attachSelectionListener(doc, ...) — mouseup on content document
  │   └── useSettingsStore
  └── AnnotationToolbar — renders when toolbarState != null
      └── onSelectType → handleSelectType
          ├── addAnnotation(store) ✓ (wrong value, but store write works)
          └── view.addAnnotation() ✗ (value format breaks resolveNavigation)
```
SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at book.resolveHref (pdf.js:182:29)
    at View.resolveNavigation (view.js:506:24)
    at View.goTo (view.js:513:27)
    at View.showAnnotation (view.js:474:33)
    at handleAnnotationClick (ReaderSidebar.tsx:47:15)
    at onNavigate (ReaderSidebar.tsx:241:33)
    at executeDispatch (react-dom-client.development.js:20610:9)
    at runWithFiberInDEV (react-dom-client.development.js:986:30)
    at processDispatchQueue (react-dom-client.development.js:20660:19)
    at react-dom-client.development.js:21234:9
    at batchedUpdates$1 (react-dom-client.development.js:3377:40)
    at dispatchEventForPluginEventSystem (react-dom-client.development.js:20814:7)
    at dispatchEvent (react-dom-client.development.js:25817:11)
    at dispatchDiscreteEvent (react-dom-client.development.js:25785:11)
```

```
Could not go to
goTo                  @ view.js:520
await in goTo
showAnnotation        @ view.js:474
handleAnnotationClick @ ReaderSidebar.tsx:47
onNavigate            @ ReaderSidebar.tsx:241
<div>
AnnotationItem        @ ReaderSidebar.tsx:279
<AnnotationItem>
(anonymous)           @ ReaderSidebar.tsx:238
AnnotationsList       @ ReaderSidebar.tsx:237
<AnnotationsList>
ReaderSidebar         @ ReaderSidebar.tsx:133
```

## Dependency Graph

```
read/page.tsx
  ├── useAnnotations hook
  │   └── useAnnotationStore (Zustand + persist → localStorage)
  ├── ReaderView
  │   ├── useReaderEvents
  │   │   └── attachSelectionListener(doc, ...) — mouseup on content document
  │   └── useSettingsStore
  └── AnnotationToolbar — renders when toolbarState != null
      └── onSelectType → handleSelectType
          ├── addAnnotation(store) ✓ (wrong value, but store write works)
          └── view.addAnnotation() ✗ (value format breaks resolveNavigation)
```

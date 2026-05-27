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

## Bug 1: Text Selection Detection (FIXED)

**Status:** Fixed in `use-reader-events.ts` and `ReaderView.tsx`

**Root cause:** Three broken approaches that never worked due to closed Shadow DOM:

| Approach | File:Line | Why it failed |
|----------|-----------|---------------|
| `setInterval` polling `shadowRoot.querySelectorAll('iframe')` | `ReaderView.tsx:122-176` | `attachShadow({ mode: 'closed' })` → `shadowRoot` is `null` |
| `document.addEventListener('mouseup', window.getSelection)` | `ReaderView.tsx:106-117` | `window.getSelection()` on main doc **cannot see** selections inside iframes |
| `message` handler casting `event.source as HTMLIFrameElement` | `ReaderView.tsx:77` | `event.source` is `WindowProxy`, not HTMLElement → `getBoundingClientRect()` throws `TypeError` |

The popup only seemed to work because the document-level `mouseup` handler occasionally caught stale selections from other interactions (e.g., after ToC clicks).

**Fix:** Attach `mouseup`/`touchend` listeners directly on the content `doc` via `foliate-view`'s `load` event:
- `doc.defaultView.getSelection()` — reads the selection inside the iframe
- `doc.defaultView.frameElement.getBoundingClientRect()` — gets iframe position for coordinate conversion

**Files changed:**
- `src/hooks/use-reader-events.ts` — added `attachSelectionListener()` function
- `src/components/ReaderView.tsx` — removed all 3 broken approaches

---

## Bug 2: Annotation `value` Format - Cannot Add Annotation (UNFIXED)

**Status:** Not yet fixed

**Files:** `src/app/read/page.tsx:155-158` and `page.tsx:199-202`

### The Problem

```typescript
// page.tsx:155-158 — handleSelectType
await viewRef.current.addAnnotation({
  value: `{text: "${toolbarState.text}", color: "${color}"}`, // WRONG
  type,
})
```

`foliate-js`'s `View.addAnnotation()` at `view.js:414` does:

```javascript
async addAnnotation(annotation, remove) {
  const { value } = annotation;
  // ...
  const { index, anchor } = await this.resolveNavigation(value); // LINE 431
  // ...
}
```

`resolveNavigation` (view.js:496) tries:
1. Is it a number? No.
2. Has `fraction` property? No (it's a string).
3. Is it a CFI? CFI parser rejects `"{text: ...}"`.
4. Fallback: `book.resolveHref(target)`:

### EPUB: TypeError

The placeholder string `"{text: ...}"` is not a valid CFI. `resolveCFI` fails, returns `undefined`. Then `resolveNavigation` returns `undefined` (no explicit return after the try-catch at line 510). Then `const { index, anchor } = await this.resolveNavigation(value)` at line 431 destructures `undefined` → **`TypeError: Cannot destructure property 'index' of '(intermediate value)' as it is null.`**

### PDF: SyntaxError

The placeholder string is passed to `book.resolveHref` (pdf.js:181):

```javascript
book.resolveHref = async (href) => {
  const parsed = JSON.parse(href); // "{text: ...}" ← not valid JSON!
  // ...
}
```

`JSON.parse("{text: \"...\", color: \"...\"}")` throws because `text` lacks double quotes (JSON requires `"text"`). Error: **`SyntaxError: Expected property name or '}' in JSON at position 1`**

### What `value` Should Be

| Format | Expected `value` | Source |
|--------|-----------------|--------|
| EPUB | CFI string: `"epubcfi(/6/2[chap01]!/4/2,/3:15)"` | `relocate` event's `e.detail.cfi` |
| PDF | JSON page ref: `JSON.stringify(pageIndex)` or TOC dest | `book.resolveHref` needs parseable JSON |

### The Fix Required

**Step 1:** Pass the CFI from the `relocate` event through the selection flow:

In `use-reader-events.ts`, modify `attachSelectionListener` to also receive the current CFI:

```typescript
function attachSelectionListener(
  doc: Document,
  onTextSelection: ...,
  currentCfi?: string,    // ← add current CFI from last relocate event
  currentPage?: number,   // ← add current page index for PDF
)
```

The CFI is available from the `relocate` event's `detail.cfi` field (view.js:378):
```javascript
const cfi = this.getCFI(index, range);
```

**Step 2:** Include `cfi` in the selection state:

```typescript
onTextSelection?.({ text, rects: viewportRects, bounds, cfi, pageIndex })
```

**Step 3:** Pass the real CFI to `addAnnotation`:

```typescript
await viewRef.current.addAnnotation({
  value: cfi,    // ← real CFI from relocate event
  type,
})
```

**Step 4:** Store the correct value:

```typescript
const annotation = addAnnotation({
  ...annotationData,
  value: cfi,   // ← store real CFI, not placeholder text
})
```

---

## Bug 3: Stored Annotation Value is Wrong (UNFIXED)

**Status:** Not yet fixed

**File:** `src/app/read/page.tsx:148-151`

```typescript
const annotation = addAnnotation({
  ...annotationData,
  value: toolbarState.text, // ← storing raw text as the location value
})
```

The `Annotation.value` field is defined as "serialized location (CFI for EPUB, JSON for PDF)" in `types/annotation.ts:19`, but the code stores the selected text instead.

### Impact

- **Annotation navigation fails:** `handleAnnotationNavigate` calls `viewRef.current.showAnnotation(annotation)` which calls `goTo(value)` → `resolveNavigation(value)` with raw text → same TypeError/SyntaxError
- **Data loss on reload:** Annotations stored with wrong value can never be navigated to or re-rendered

### Fix

Same as Bug 2 — pass the real CFI or PDF page reference.

---

## Bug 4: Toolbar Position for PDF Offset (UNVERIFIED)

**Status:** May still exist after Fix 1

**File:** `src/app/read/page.tsx:122-127`

The toolbar position uses `state.bounds.x/y`, which after Fix 1 are correctly converted to viewport coordinates. However, if PDF pages render with zoom/scaling, the `frameElement.getBoundingClientRect()` might return a rect that doesn't account for the PDF zoom transform (see `pdf.js:20-22`):

```javascript
doc.documentElement.style.transform = `scale(${1 / devicePixelRatio})`;
```

This could cause a mismatch between the text's visual position and the iframe element's bounding rect. The `AnnotationToolbar` then renders at:

```typescript
// AnnotationToolbar.tsx:94-98
left: Math.min(position.x, window.innerWidth - 280),
top: Math.max(position.y - 120, 10),
```

If `position.x/y` is wrong, the toolbar appears offset from the selected text.

---

## Bug 5: getOverlayDrawFunction is Unused (DEAD CODE)

**Status:** Code exists but never called

**File:** `src/store/annotation-store.ts:119-136`

```typescript
export function getOverlayDrawFunction(type: AnnotationType) {
  return async (type: AnnotationType) => {   // ← parameter shadows outer `type`
    const { Overlayer } = await import('foliate-js/overlayer.js')
    switch (type) {                           // ← uses inner `type`, outer is unused
      case 'underline': return Overlayer.underline
      // ...
    }
  }
}
```

This function takes a `type` parameter but then returns an **async function** that ALSO takes a `type` parameter — the outer one is shadowed. Additionally, this function is **never imported or called** anywhere in the app. The `draw` function passed to `view.addAnnotation` should come from the `draw-annotation` event callback, but it's not wired up correctly in `read/page.tsx` or `use-reader-events.ts`.

---

## Bug 6: useAnnotationStore Full Subscription (PERFORMANCE)

**Status:** Not fixed

**File:** `src/hooks/use-annotations.ts:17`

```typescript
const store = useAnnotationStore()
```

This subscribes to the **entire** store — any annotation change for **any book** causes this hook to re-render. Should use individual selectors:

```typescript
const addAnnotation = useAnnotationStore((s) => s.addAnnotation)
```

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

## Summary of Remaining Work

| Bug | File | Severity | Fix |
|-----|------|----------|-----|
| 2. Wrong `value` format | `page.tsx:155-158` | Critical | Pass CFI from relocate event |
| 3. Wrong stored `value` | `page.tsx:148-151` | Critical | Store CFI, not text |
| 2/3. Note saves same bug | `page.tsx:189-201` | Critical | Same fix |
| 4. PDF position offset | `page.tsx:122-127` | Medium | Verify after Fix 1 |
| 5. Dead code | `annotation-store.ts:119` | Low | Remove or wire up |
| 6. Full store subscription | `use-annotations.ts:17` | Low | Use selectors |

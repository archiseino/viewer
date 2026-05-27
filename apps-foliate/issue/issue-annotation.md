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
goTo @ view.js:520
await in goTo
showAnnotation @ view.js:474
handleAnnotationClick @ ReaderSidebar.tsx:47
onNavigate @ ReaderSidebar.tsx:241

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

| Feature                  | EPUB (Paginator)              | PDF (FixedLayout)                      |
| ------------------------ | ----------------------------- | -------------------------------------- |
| Renderer                 | `foliate-view` (paginator.js) | `foliate-fxl` (fixed-layout.js)        |
| `getContents()` returns  | `{ index, overlayer, doc }`   | `{ doc }` — **no index, no overlayer** |
| `create-overlayer` event | Dispatched per content view   | **Not implemented**                    |
| Index tracking           | Via spine item index          | Page numbers via `this.index`          |
| Annotation value         | CFI string (`epubcfi(...)`)   | Not handled                            |

### Issue 1 — The overlayer on PDF annotation are not shown

Somewhat we can add the annotation on the PDF that based on the fixed_layout.js, it shows on the book the annotation, but after change page / reload pages, the annotations are gone, even though in localStorage the annotation is stored.

Secondly we need to have a way to make the selection and the annotation can persist accross resize, rotation and etc, so somewhat we need to using calculation to determine the change of position of the annotate respect to something

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

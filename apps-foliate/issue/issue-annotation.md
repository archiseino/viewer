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

** Issue to Reproduce **
So it seems for the Overlayer that supposed to have the effect on text like Highlight, color, underline, strikethrough and etc, are not displayed in Epub, but it's somewhat being push into annotation, just not have the styles of annotation.

Also does it possible to have the annotaion pop up when we load the docs, because it require navigate the content from ToC to activate the pop up

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

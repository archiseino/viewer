# Phase 3: Progress Tracking

**Goal:** Reading position persists across sessions — reopen a book and jump to where you left off.

## How foliate-js Supports This

The `<foliate-view>` web component:

- Fires a `relocate` event on every navigation (page turn, scroll, TOC jump)
- `e.detail` contains `{ fraction, section, location, cfi, tocItem, range }`
- The `fraction` field is a 0–1 float — **works for both EPUB (cfi) and PDF (section-based)**
- `view.init({ lastLocation })` accepts the same shape and restores position

PDF note: PDF.js in foliate-js splits each PDF page into a section. The `relocate` event fires with `fraction` and `section`, but no `cfi` — this is fine. The `fraction` field is the universal cross-format key.

## Files to Create / Modify

| File | Action |
|---|---|
| `store/progress-store.ts` | Created in 00-architecture |
| `hooks/use-progress.ts` | Created in 00-architecture |
| `lib/debounce.ts` | Created in 00-architecture |
| `hooks/use-reader-events.ts` | Created in 00-architecture — `relocate` handler calls `useProgress.save` |
| `components/ReaderView.tsx` | Modified — pass `lastLocation` to `init()`, thread view ref + filename to events hook |

## ReaderView Modifications

### New Props

```ts
interface ReaderViewProps {
  file: File
  lastLocation?: unknown
  onViewReady?: (view: FoliateView) => void
}
```

### Integration

In the `useEffect` that creates the foliate-view:

```ts
// Before init, pass saved location
await view.open(file)
await view.init({
  lastLocation: props.lastLocation ?? undefined,
  showTextStart: !props.lastLocation,
})
props.onViewReady?.(view)
```

The `relocate` listener is handled by `use-reader-events.ts` which is called in `ReaderView`:

```ts
useReaderEvents(viewRef.current, (loc) => {
  saveProgress(loc)
})
```

But wait — `useReaderEvents` already calls `setLocation` and `onRelocate`. The progress save happens inside `useReaderEvents`? No, actually, the progress save should happen from the page level. Let me clarify the flow:

1. `ReaderView` calls `useReaderEvents(view, onRelocate)`
2. Inside `useReaderEvents`, the `relocate` event handler calls `setLocation(loc)` (reader-store) and `onRelocate(loc)` (page callback)
3. The page's `onRelocate` callback calls `saveProgress(loc)` from `useProgress`
4. `useProgress` debounces and writes to `progress-store`

This avoids coupling progress logic inside `useReaderEvents`.

## Flow Summary

```
Book opens → ReaderView.init({ lastLocation })
                           ↓
              User navigates pages
                           ↓
         relocate event → useReaderEvents
                           ↓  ↓
              reader-store    onRelocate callback (read/page.tsx)
              setLocation            ↓
                              useProgress.saveProgress
                                     ↓
                              progress-store (zustand persist → localStorage)

Re-open book → loadProgress(filename) → lastLocation → ReaderView.init()
```

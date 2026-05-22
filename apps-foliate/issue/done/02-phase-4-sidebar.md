# Phase 4: Sidebar (TOC + Progress Scroller)

**Goal:** A collapsible left drawer showing the book's table of contents and a draggable progress bar.

## Data Sources

| Data | Source | How to access |
|---|---|---|
| TOC tree | foliate-js | `view.book.toc` — array of `{ label, href, subitems[] }` |
| Current section | reader-store | `currentLocation.tocItem` — gives the active TOC item |
| Current fraction | reader-store | `currentLocation.fraction` — 0–1 |
| Section fractions | foliate-js | `view.getSectionFractions()` — array for slider markers |

## File to Create

### `components/ReaderSidebar.tsx`

Uses shadcn `Sheet` (left side), `ScrollArea`, `Slider`.

```tsx
'use client'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { useReaderStore } from '@/store/reader-store'
import { cn } from '@/lib/utils'
import { List, BookOpen } from 'lucide-react'

interface ReaderSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReaderSidebar({ open, onOpenChange }: ReaderSidebarProps) {
  const viewRef = useReaderStore((s) => s.viewRef)
  const toc = useReaderStore((s) => s.toc)
  const currentLocation = useReaderStore((s) => s.currentLocation)

  const handleTocClick = (href: string) => {
    viewRef?.goTo(href)
    onOpenChange(false)
  }

  const handleFractionChange = ([value]: number[]) => {
    viewRef?.goToFraction(value)
  }

  const fraction = currentLocation?.fraction ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='left' className='flex flex-col p-0 w-72 sm:max-w-72'>
        <SheetTitle className='sr-only'>Table of Contents</SheetTitle>

        {/* TOC List */}
        <ScrollArea className='flex-1 px-4 py-4'>
          <nav className='space-y-0.5'>
            {toc?.map((item, i) => (
              <TocItem
                key={i}
                item={item}
                depth={0}
                activeLabel={currentLocation?.tocItem?.label}
                onClick={handleTocClick}
              />
            ))}
            {!toc?.length && (
              <p className='text-sm text-muted-foreground text-center py-8'>
                No table of contents
              </p>
            )}
          </nav>
        </ScrollArea>

        {/* Progress Scroller */}
        <div className='border-t p-4 space-y-2'>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <BookOpen className='size-3.5' />
            <span>
              Section {currentLocation?.section.current ?? 0} of{' '}
              {currentLocation?.section.total ?? 0}
            </span>
          </div>
          <Slider
            value={[fraction]}
            min={0}
            max={1}
            step={0.001}
            onValueChange={handleFractionChange}
          />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>{Math.round(fraction * 100)}%</span>
            <span>Location {currentLocation?.location.current ?? 0}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Recursive TOC item
function TocItem({
  item,
  depth,
  activeLabel,
  onClick,
}: {
  item: { label: string; href?: string; subitems?: { label: string; href?: string }[] }
  depth: number
  activeLabel?: string
  onClick: (href: string) => void
}) {
  const isActive = item.label === activeLabel
  return (
    <div>
      <button
        onClick={() => item.href && onClick(item.href)}
        className={cn(
          'w-full text-left text-sm rounded px-2 py-1 transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent font-medium text-accent-foreground',
          depth > 0 && 'ml-4'
        )}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub, i) => (
        <TocItem
          key={i}
          item={sub}
          depth={depth + 1}
          activeLabel={activeLabel}
          onClick={onClick}
        />
      ))}
    </div>
  )
}
```

## Modified File: `src/app/read/page.tsx`

### Header additions

```tsx
// State
const [sidebarOpen, setSidebarOpen] = useState(false)

// In the header:
<Button variant='ghost' size='sm' onClick={() => setSidebarOpen(true)}>
  <List className='size-4' />
</Button>
<span className='truncate text-sm font-medium'>{title}</span>

// Alongside other panels:
<ReaderSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
```

### Exposing view ref

In `ReaderView`, add the `onViewReady` prop. In the page, store it:

```tsx
const setViewRef = useReaderStore((s) => s.setViewRef)

<ReaderView
  file={file}
  lastLocation={lastLocation}
  onViewReady={(view) => setViewRef(view)}
  onRelocate={handleRelocate}
/>
```

## Interaction

```
User taps sidebar button
       ↓
  Sheet opens (left side)
       ↓
  [TOC tree]         [Progress slider]
  (click item)        (drag slider)
       ↓                     ↓
  view.goTo(href)     view.goToFraction(v)
  + close sheet        + update reader-store
```

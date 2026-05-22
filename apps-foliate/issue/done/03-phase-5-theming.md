# Phase 5: Settings & Theming

**Goal:** User controls font family, font size, margins, line height, and color scheme — persisted across sessions and applied to the EPUB/PDF iframe content.

## Settings Options

| Setting | Type | Range | Default |
|---|---|---|---|
| colorScheme | `'light' \| 'dark' \| 'sepia' \| 'system'` | — | `'system'` |
| fontFamily | string (free input + presets) | — | `'system-ui'` |
| fontSize | number (slider) | 75–175 | 100 |
| margins | number (slider) | 8–48 px | 16 |
| lineHeight | number (slider) | 1.2–2.2 | 1.5 |

Font presets: `system-ui`, `serif`, `sans-serif`, `'Georgia, serif'`, `'Bookerly, serif'`, `'Helvetica, sans-serif'`, `'OpenDyslexic, sans-serif'`

## How CSS Reaches the EPUB iframe

foliate-js renders EPUB content inside shadow DOM iframes. Light-DOM CSS variables don't cross the iframe boundary, so we inject a `<style>` into each section document:

1. **On `load` event** — fires per-section when its iframe is ready
2. **On settings change** — iterate all open sections via `view.renderer.getContents()` and update
3. **Style element** — `<style id="foliate-theme">` injected into each section's `<head>`

This is handled by `services/theme-css.ts` (defined in 00-architecture).

## Files to Create / Modify

| File | Action |
|---|---|
| `store/settings-store.ts` | Created in 00-architecture |
| `services/theme-css.ts` | Created in 00-architecture |
| `context/ThemeProvider.tsx` | Created in 00-architecture |
| `components/SettingsPanel.tsx` | **New** — settings UI in a right-side Sheet |
| `components/ReaderView.tsx` | Modified — subscribe to settings, re-inject theme on change |
| `hooks/use-reader-events.ts` | Created in 00-architecture — `load` handler calls `injectTheme` |
| `app/layout.tsx` | Created in 00-architecture — wrap with ThemeProvider |

## Component: `components/SettingsPanel.tsx`

```tsx
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settings-store'
import { cn } from '@/lib/utils'
import { Sun, Moon, Eye, Monitor } from 'lucide-react'

const FONT_PRESETS = [
  { label: 'System UI', value: 'system-ui' },
  { label: 'Serif', value: 'serif' },
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Georgia', value: "'Georgia, serif'" },
  { label: 'Bookerly', value: "'Bookerly, serif'" },
  { label: 'Helvetica', value: "'Helvetica, sans-serif'" },
  { label: 'OpenDyslexic', value: "'OpenDyslexic, sans-serif'" },
]

const SCHEMES = [
  { label: 'Light', value: 'light', icon: Sun },
  { label: 'Dark', value: 'dark', icon: Moon },
  { label: 'Sepia', value: 'sepia', icon: Eye },
  { label: 'System', value: 'system', icon: Monitor },
] as const

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const settings = useSettingsStore()
  const { updateSettings } = settings

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-80 sm:max-w-80'>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          {/* Color Scheme */}
          <section className='space-y-3'>
            <Label>Color Scheme</Label>
            <div className='flex gap-2'>
              {SCHEMES.map(({ label, value, icon: Icon }) => (
                <Button
                  key={value}
                  variant={settings.colorScheme === value ? 'default' : 'outline'}
                  size='sm'
                  className='flex-1'
                  onClick={() => updateSettings({ colorScheme: value })}
                >
                  <Icon className='size-4 mr-1' />
                  {label}
                </Button>
              ))}
            </div>
          </section>

          {/* Font Family */}
          <section className='space-y-3'>
            <Label>Font</Label>
            <div className='flex flex-wrap gap-1.5'>
              {FONT_PRESETS.map(({ label, value }) => (
                <Button
                  key={value}
                  variant={settings.fontFamily === value ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => updateSettings({ fontFamily: value })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Input
              placeholder='Custom font name…'
              value={
                FONT_PRESETS.some((p) => p.value === settings.fontFamily)
                  ? ''
                  : settings.fontFamily
              }
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            />
          </section>

          {/* Font Size */}
          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Font Size</Label>
              <span className='text-xs text-muted-foreground'>
                {settings.fontSize}%
              </span>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={75}
              max={175}
              step={5}
              onValueChange={([v]) => updateSettings({ fontSize: v })}
            />
          </section>

          {/* Margins */}
          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Margins</Label>
              <span className='text-xs text-muted-foreground'>
                {settings.margins}px
              </span>
            </div>
            <Slider
              value={[settings.margins]}
              min={8}
              max={48}
              step={4}
              onValueChange={([v]) => updateSettings({ margins: v })}
            />
          </section>

          {/* Line Height */}
          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Line Height</Label>
              <span className='text-xs text-muted-foreground'>
                {settings.lineHeight.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[settings.lineHeight]}
              min={1.2}
              max={2.2}
              step={0.1}
              onValueChange={([v]) => updateSettings({ lineHeight: v })}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

## Modifications to `src/components/ReaderView.tsx`

`use-reader-events.ts` already injects theme on `load` events. On settings change, we also need to update all already-loaded sections.

Add a `useEffect` in `ReaderView` that watches settings and re-applies:

```ts
const settings = useSettingsStore((s) => ({
  fontFamily: s.fontFamily,
  fontSize: s.fontSize,
  margins: s.margins,
  lineHeight: s.lineHeight,
}))

useEffect(() => {
  const view = viewRef.current
  if (!view) return
  updateAllThemes(settings, () =>
    (view.renderer as { getContents?: () => { doc?: Document }[] })
      ?.getContents?.() ?? []
  )
}, [settings])
```

## Modifications to `src/app/read/page.tsx`

Add settings button + panel:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false)

// In the header, next to the sidebar toggle:
<Button variant='ghost' size='sm' onClick={() => setSettingsOpen(true)}>
  <Settings className='size-4' />
</Button>

// Alongside ReaderSidebar:
<SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
```

## Flow Summary

```
User opens Settings Panel
       ↓
  Changes font/size/margins/scheme
       ↓
  settingsStore.updateSettings(partial)
       ↓
  Zustand persist middleware → localStorage
       ↓
useSettingsStore subscription fires
       ↓
  ThemeProvider (context)        ReaderView (component)
  toggles .dark class            updateAllThemes(view.renderer)
  or sepia CSS vars              injects/updates style in each iframe

On load event for new sections:
  useReaderEvents → injectTheme(doc, settings)
```

'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settings-store'
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
  const colorScheme = useSettingsStore((s) => s.colorScheme)
  const fontFamily = useSettingsStore((s) => s.fontFamily)
  const fontSize = useSettingsStore((s) => s.fontSize)
  const margins = useSettingsStore((s) => s.margins)
  const lineHeight = useSettingsStore((s) => s.lineHeight)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-80 sm:max-w-80'>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          <section className='space-y-3'>
            <Label>Color Scheme</Label>
            <div className='flex gap-2'>
              {SCHEMES.map(({ label, value, icon: Icon }) => (
                <Button
                  key={value}
                  variant={colorScheme === value ? 'default' : 'outline'}
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

          <section className='space-y-3'>
            <Label>Font</Label>
            <div className='flex flex-wrap gap-1.5'>
              {FONT_PRESETS.map(({ label, value }) => (
                <Button
                  key={value}
                  variant={fontFamily === value ? 'default' : 'outline'}
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
                FONT_PRESETS.some((p) => p.value === fontFamily)
                  ? ''
                  : fontFamily
              }
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            />
          </section>

          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Font Size</Label>
              <span className='text-xs text-muted-foreground'>
                {fontSize}%
              </span>
            </div>
            <Slider
              value={[fontSize]}
              min={75}
              max={175}
              step={5}
              onValueChange={([v]) => updateSettings({ fontSize: v })}
            />
          </section>

          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Margins</Label>
              <span className='text-xs text-muted-foreground'>
                {margins}px
              </span>
            </div>
            <Slider
              value={[margins]}
              min={8}
              max={48}
              step={4}
              onValueChange={([v]) => updateSettings({ margins: v })}
            />
          </section>

          <section className='space-y-3'>
            <div className='flex justify-between'>
              <Label>Line Height</Label>
              <span className='text-xs text-muted-foreground'>
                {lineHeight.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[lineHeight]}
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

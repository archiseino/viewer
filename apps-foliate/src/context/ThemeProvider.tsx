'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme)

  useEffect(() => {
    const root = document.documentElement

    const apply = (scheme: string) => {
      root.classList.remove('dark', 'sepia', 'green')
      if (scheme === 'dark') root.classList.add('dark')
      if (scheme === 'sepia') {
        root.style.setProperty('--background', '#f5f0e8')
        root.style.setProperty('--foreground', '#5c4a3a')
      } else if (scheme === 'green') {
        root.classList.add('green')
      } else {
        root.style.removeProperty('--background')
        root.style.removeProperty('--foreground')
      }
    }

    if (colorScheme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply(mq.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      handler()
      return () => mq.removeEventListener('change', handler)
    }

    apply(colorScheme)
  }, [colorScheme])

  return <>{children}</>
}

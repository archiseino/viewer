import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColorScheme } from '@/types/settings'

interface SettingsState {
  colorScheme: ColorScheme
  fontFamily: string
  fontSize: number
  margins: number
  lineHeight: number
}

interface SettingsActions {
  updateSettings: (partial: Partial<SettingsState>) => void
  resetSettings: () => void
}

type SettingsStore = SettingsState & SettingsActions

const defaults: SettingsState = {
  colorScheme: 'system',
  fontFamily: 'system-ui',
  fontSize: 100,
  margins: 16,
  lineHeight: 1.5,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      updateSettings: (partial) => set(partial),
      resetSettings: () => set(defaults),
    }),
    { name: 'foliate-settings' }
  )
)

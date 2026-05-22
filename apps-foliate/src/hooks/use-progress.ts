'use client'

import { useCallback, useMemo } from 'react'
import { debounce } from '@/lib/debounce'
import { useProgressStore } from '@/store/progress-store'
import type { LocationData } from '@/types/reader'

export function useProgress(filename: string | null) {
  const saveProgress = useProgressStore((s) => s.saveProgress)
  const loadProgress = useProgressStore((s) => s.loadProgress)

  const lastLocation = filename ? loadProgress(filename) : null

  const debouncedSave = useMemo(
    () =>
      debounce((data: LocationData) => {
        if (filename) saveProgress(filename, data)
      }, 1000),
    [filename, saveProgress]
  )

  const save = useCallback(
    (data: LocationData) => {
      debouncedSave(data)
    },
    [debouncedSave]
  )

  return { lastLocation, saveProgress: save }
}

'use client'

import { useState, useEffect } from 'react'
import type React from 'react'

/**
 * sessionStorageに永続化するuseStateラッパー
 * filtersHydratedがtrueになるまで保存しない（復元は呼び出し側で一括実行する前提）
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T,
  filtersHydrated: boolean
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue)
  useEffect(() => {
    if (filtersHydrated) {
      sessionStorage.setItem(`cards-filter-${key}`, JSON.stringify(value))
    }
  }, [key, value, filtersHydrated])
  return [value, setValue]
}

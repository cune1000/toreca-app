'use client'

import { useState, useCallback, useRef } from 'react'
import type { JTCard } from './useJustTcgState'

const BATCH_SIZE = 50

export function useTranslation() {
  // セットID → { cardId → 日本語名 }
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({})
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState('')
  const [translationProgress, setTranslationProgress] = useState<{ current: number; total: number } | null>(null)
  const cancelRef = useRef(false)

  const translateSet = useCallback(async (
    setId: string,
    cards: JTCard[],
    game: string,
    setNameEn?: string,
    setNameJa?: string,
  ) => {
    // キャッシュヒット: 未翻訳のカードのみ処理
    const cached = translations[setId] || {}
    const untranslated = cards.filter(c => !cached[c.id])
    if (untranslated.length === 0) return

    setTranslating(true)
    setTranslationError('')
    setTranslationProgress({ current: 0, total: untranslated.length })
    cancelRef.current = false

    try {
      let processed = 0
      for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
        if (cancelRef.current) break

        const batch = untranslated.slice(i, i + BATCH_SIZE)
        const res = await fetch('/api/justtcg/translate-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            names: batch.map(c => ({ id: c.id, name: c.name })),
            game,
            setNameEn,
            setNameJa,
          }),
        })

        if (res.status === 429) {
          // レート制限: 少し待ってリトライ
          await new Promise(r => setTimeout(r, 6000))
          i -= BATCH_SIZE // リトライ
          continue
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const json = await res.json()
        if (json.success && json.data) {
          setTranslations(prev => ({
            ...prev,
            [setId]: { ...prev[setId], ...json.data },
          }))
        }

        processed = Math.min(i + BATCH_SIZE, untranslated.length)
        setTranslationProgress({ current: processed, total: untranslated.length })

        // バッチ間の待機（レート制限回避）
        if (i + BATCH_SIZE < untranslated.length && !cancelRef.current) {
          await new Promise(r => setTimeout(r, 5500))
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '翻訳に失敗しました'
      setTranslationError(msg)
    } finally {
      setTranslating(false)
      setTranslationProgress(null)
    }
  }, [translations])

  const cancelTranslation = useCallback(() => {
    cancelRef.current = true
  }, [])

  const getJaName = useCallback((setId: string, cardId: string): string | undefined => {
    return translations[setId]?.[cardId]
  }, [translations])

  return { translations, translating, translationError, translationProgress, translateSet, cancelTranslation, getJaName }
}

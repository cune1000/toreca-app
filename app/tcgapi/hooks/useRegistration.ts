'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { TcgCard, TcgSet } from './useTcgApiState'

export function useRegistration(
  cards: TcgCard[],
  selectedSet: TcgSet | null,
  selectedGame: string,
) {
  const [checkedCards, setCheckedCards] = useState<Set<string>>(new Set())
  const [jaNames, setJaNames] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState<Record<string, boolean>>({})
  const [registered, setRegistered] = useState<Record<string, boolean>>({})
  const [registerError, setRegisterError] = useState<Record<string, string>>({})
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; succeeded: number; failed: number } | null>(null)
  const cancelBulkRef = useRef(false)

  // 収録弾名オーバーライド（セット単位で編集可能）
  const [expansionOverride, setExpansionOverride] = useState('')

  // セット切替時にステートをリセット
  const prevSetId = useRef(selectedSet ? String(selectedSet.id) : undefined)
  useEffect(() => {
    const currentSetId = selectedSet ? String(selectedSet.id) : undefined
    if (currentSetId !== prevSetId.current) {
      prevSetId.current = currentSetId
      cancelBulkRef.current = true
      setCheckedCards(new Set())
      setJaNames({})
      setRegistering({})
      setRegistered({})
      setRegisterError({})
      setBulkProgress(null)
      setExpansionOverride('')
    }
  }, [selectedSet])

  // DB登録済みチェック: カード読み込み時にtcgplayer_idで一括照会
  useEffect(() => {
    if (cards.length === 0) return
    const controller = new AbortController()
    const ids = cards.map(c => String(c.tcgplayer_id))
    fetch('/api/tcgapi/check-registered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tcgplayer_ids: ids }),
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => {
        if (controller.signal.aborted || !json.success) return
        const map: Record<string, boolean> = {}
        for (const id of json.registeredIds) map[id] = true
        setRegistered(map)
        // 登録済みカードの日本語名を事前セット
        if (json.registeredNames) {
          setJaNames(prev => {
            const next = { ...prev }
            for (const [id, name] of Object.entries(json.registeredNames as Record<string, string>)) {
              if (!next[id]) next[id] = name
            }
            return next
          })
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') console.warn('Registration check failed:', e)
      })
    return () => controller.abort()
  }, [cards])

  const toggleCheck = useCallback((cardId: string) => {
    setCheckedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }, [])

  const toggleAllFiltered = useCallback((filteredIds: string[]) => {
    setCheckedCards(prev => {
      const allChecked = filteredIds.length > 0 && filteredIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allChecked) {
        filteredIds.forEach(id => next.delete(id))
      } else {
        filteredIds.forEach(id => next.add(id))
      }
      return next
    })
  }, [])

  const setJaName = useCallback((cardId: string, name: string) => {
    setJaNames(prev => ({ ...prev, [cardId]: name }))
  }, [])

  // ref で最新値を保持
  const jaNamesRef = useRef(jaNames)
  jaNamesRef.current = jaNames
  const selectedSetRef = useRef(selectedSet)
  selectedSetRef.current = selectedSet
  const selectedGameRef = useRef(selectedGame)
  selectedGameRef.current = selectedGame
  const expansionOverrideRef = useRef(expansionOverride)
  expansionOverrideRef.current = expansionOverride

  // デフォルト収録弾名（日本語名 → 英語名フォールバック）
  const defaultExpansion = useMemo(
    () => selectedSet?.nameJa || selectedSet?.name || '',
    [selectedSet],
  )

  /** カード1件を登録 */
  const handleRegister = useCallback(async (card: TcgCard): Promise<boolean> => {
    const key = String(card.tcgplayer_id)
    const jaName = jaNamesRef.current[key]?.trim()
    if (!jaName) {
      setRegisterError(prev => ({ ...prev, [key]: '日本語名を入力してください' }))
      return false
    }
    const capturedSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
    const cardKey = key
    setRegistering(prev => ({ ...prev, [cardKey]: true }))
    setRegisterError(prev => ({ ...prev, [cardKey]: '' }))

    const currentSet = selectedSetRef.current

    try {
      const res = await fetch('/api/tcgapi/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jaName,
          name_en: card.name,
          card_number: card.number,
          rarity: card.rarity,
          set_name_en: currentSet?.name || '',
          release_date: currentSet?.release_date || null,
          expansion: expansionOverrideRef.current || currentSet?.nameJa || currentSet?.name || '',
          image_url: card.image_url,
          tcgplayer_id: String(card.tcgplayer_id),
          game: selectedGameRef.current,
        }),
      })
      if (!res.ok && res.status !== 409) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      const currentSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (currentSetId !== capturedSetId) return false
      if (json.success) {
        setRegistered(prev => ({ ...prev, [cardKey]: true }))
        setCheckedCards(prev => {
          const next = new Set(prev)
          next.delete(cardKey)
          return next
        })
        return true
      } else {
        setRegisterError(prev => ({ ...prev, [cardKey]: json.error || '登録失敗' }))
        if (res.status === 409) {
          setRegistered(prev => ({ ...prev, [cardKey]: true }))
          return true
        }
        return false
      }
    } catch (e: unknown) {
      const currentSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (currentSetId !== capturedSetId) return false
      const message = e instanceof Error ? e.message : '登録エラー'
      setRegisterError(prev => ({ ...prev, [cardKey]: message }))
      return false
    } finally {
      const currentSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (currentSetId === capturedSetId) {
        setRegistering(prev => ({ ...prev, [cardKey]: false }))
      }
    }
  }, [])

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const checkedCardsRef = useRef(checkedCards)
  checkedCardsRef.current = checkedCards
  const registeredRef = useRef(registered)
  registeredRef.current = registered

  const bulkRunningRef = useRef(false)

  const handleBulkRegister = useCallback(async () => {
    if (bulkRunningRef.current) return
    bulkRunningRef.current = true
    const capturedSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
    try {
      const toRegister = cardsRef.current.filter(c =>
        checkedCardsRef.current.has(String(c.tcgplayer_id)) && !registeredRef.current[String(c.tcgplayer_id)] && jaNamesRef.current[String(c.tcgplayer_id)]?.trim()
      )
      if (toRegister.length === 0) return
      cancelBulkRef.current = false
      let succeeded = 0
      let failed = 0
      setBulkProgress({ current: 0, total: toRegister.length, succeeded: 0, failed: 0 })
      for (let i = 0; i < toRegister.length; i++) {
        const currentSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
        if (cancelBulkRef.current || currentSetId !== capturedSetId) break
        if (i > 0) await new Promise(r => setTimeout(r, 5500))
        const afterWaitSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
        if (cancelBulkRef.current || afterWaitSetId !== capturedSetId) break
        const ok = await handleRegister(toRegister[i])
        if (ok) succeeded++
        else failed++
        setBulkProgress({ current: i + 1, total: toRegister.length, succeeded, failed })
      }
      const finalSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (finalSetId === capturedSetId) {
        setBulkProgress(null)
      }
    } finally {
      bulkRunningRef.current = false
      const finalSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (finalSetId === capturedSetId) {
        setBulkProgress(null)
      }
    }
  }, [handleRegister])

  const handleBulkOverwrite = useCallback(async () => {
    if (bulkRunningRef.current) return
    bulkRunningRef.current = true
    const capturedSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
    try {
      const toOverwrite = cardsRef.current.filter(c =>
        checkedCardsRef.current.has(String(c.tcgplayer_id)) && registeredRef.current[String(c.tcgplayer_id)] && jaNamesRef.current[String(c.tcgplayer_id)]?.trim()
      )
      if (toOverwrite.length === 0) return
      cancelBulkRef.current = false
      let succeeded = 0, failed = 0
      setBulkProgress({ current: 0, total: toOverwrite.length, succeeded: 0, failed: 0 })
      for (let i = 0; i < toOverwrite.length; i++) {
        const currentSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
        if (cancelBulkRef.current || currentSetId !== capturedSetId) break
        if (i > 0) await new Promise(r => setTimeout(r, 5500))
        const afterWaitSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
        if (cancelBulkRef.current || afterWaitSetId !== capturedSetId) break
        const ok = await handleRegister(toOverwrite[i])
        if (ok) succeeded++; else failed++
        setBulkProgress({ current: i + 1, total: toOverwrite.length, succeeded, failed })
      }
      const finalSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (finalSetId === capturedSetId) setBulkProgress(null)
    } finally {
      bulkRunningRef.current = false
      const finalSetId = selectedSetRef.current ? String(selectedSetRef.current.id) : undefined
      if (finalSetId === capturedSetId) {
        setBulkProgress(null)
      }
    }
  }, [handleRegister])

  const cancelBulkRegister = useCallback(() => {
    cancelBulkRef.current = true
  }, [])

  const checkedCount = checkedCards.size
  const readyCount = useMemo(() =>
    cards.filter(c => checkedCards.has(String(c.tcgplayer_id)) && jaNames[String(c.tcgplayer_id)]?.trim() && !registered[String(c.tcgplayer_id)]).length
  , [cards, checkedCards, jaNames, registered])
  const readyOverwriteCount = useMemo(() =>
    cards.filter(c => checkedCards.has(String(c.tcgplayer_id)) && jaNames[String(c.tcgplayer_id)]?.trim() && registered[String(c.tcgplayer_id)]).length
  , [cards, checkedCards, jaNames, registered])

  return {
    checkedCards,
    jaNames,
    registering,
    registered,
    registerError,
    checkedCount,
    readyCount,
    readyOverwriteCount,
    bulkProgress,
    expansionOverride,
    defaultExpansion,
    setExpansionOverride,
    toggleCheck,
    toggleAllFiltered,
    setJaName,
    handleRegister,
    handleBulkRegister,
    handleBulkOverwrite,
    cancelBulkRegister,
  }
}

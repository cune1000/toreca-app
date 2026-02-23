'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { getSetNameJa, extractSetCode, extractReleaseYear } from '@/lib/justtcg-set-names'
import type { JTCard, JTSet, PCMatch } from './useJustTcgState'

export function useRegistration(
  cards: JTCard[],
  selectedSet: JTSet | null,
  selectedGame: string,
  pcMatches: Record<string, PCMatch | null>,
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

  // セット切替時にステートをリセット（registeredは保持しない — 別セットのIDなので無意味）
  const prevSetId = useRef(selectedSet?.id)
  useEffect(() => {
    if (selectedSet?.id !== prevSetId.current) {
      prevSetId.current = selectedSet?.id
      cancelBulkRef.current = true // R11-01: 進行中の一括登録を中断
      setCheckedCards(new Set())
      setJaNames({})
      setRegistering({})
      setRegistered({})
      setRegisterError({})
      setBulkProgress(null)
      setExpansionOverride('')
    }
  }, [selectedSet?.id])

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
      // R12-26: 登録済みカードを除外して選択
      const unregistered = filteredIds.filter(id => !registeredRef.current[id])
      const allChecked = unregistered.length > 0 && unregistered.every(id => prev.has(id))
      const next = new Set(prev)
      if (allChecked) {
        unregistered.forEach(id => next.delete(id))
      } else {
        unregistered.forEach(id => next.add(id))
      }
      return next
    })
  }, [])

  const setJaName = useCallback((cardId: string, name: string) => {
    setJaNames(prev => ({ ...prev, [cardId]: name }))
  }, [])

  // ref で最新値を保持し、useCallback の deps から除外（stale closure 防止）
  const jaNamesRef = useRef(jaNames)
  jaNamesRef.current = jaNames
  const pcMatchesRef = useRef(pcMatches)
  pcMatchesRef.current = pcMatches
  const selectedSetRef = useRef(selectedSet)
  selectedSetRef.current = selectedSet
  const selectedGameRef = useRef(selectedGame)
  selectedGameRef.current = selectedGame
  const expansionOverrideRef = useRef(expansionOverride)
  expansionOverrideRef.current = expansionOverride

  // デフォルト収録弾名（マッピング or セット名）
  const defaultExpansion = useMemo(
    () => selectedSet ? getSetNameJa(selectedSet.id, selectedSet.name) : '',
    [selectedSet],
  )

  /** カード1件を登録。成功（or 既に登録済み）なら true を返す */
  const handleRegister = useCallback(async (card: JTCard): Promise<boolean> => {
    const jaName = jaNamesRef.current[card.id]?.trim()
    if (!jaName) {
      setRegisterError(prev => ({ ...prev, [card.id]: '日本語名を入力してください' }))
      return false
    }
    // R14-02: セット切替ガード（fetch中にセット切替されたらstale write防止）
    const capturedSetId = selectedSetRef.current?.id
    setRegistering(prev => ({ ...prev, [card.id]: true }))
    setRegisterError(prev => ({ ...prev, [card.id]: '' }))

    const pc = pcMatchesRef.current[card.id]
    const currentSet = selectedSetRef.current
    const setCode = currentSet ? extractSetCode(currentSet.id) : null
    const releaseYear = currentSet ? extractReleaseYear(currentSet.release_date) : null

    try {
      const res = await fetch('/api/justtcg/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jaName,
          name_en: card.name,
          card_number: card.number,
          rarity: card.rarity,
          set_code: setCode,
          set_name_en: currentSet?.name || card.set_name,
          release_year: releaseYear,
          expansion: expansionOverrideRef.current || (currentSet ? getSetNameJa(currentSet.id, currentSet.name) : card.set_name),
          image_url: pc?.imageUrl || null,
          justtcg_id: card.id,
          tcgplayer_id: null, // R13-INT06: JustTCG variant IDはTCGPlayer IDではない
          pricecharting_id: pc?.id ? String(pc.id) : null,
          pricecharting_name: pc?.name || card.name, // PC名優先、なければJustTCG英語名
          pricecharting_url: pc?.pricechartingUrl || null,
          game: selectedGameRef.current,
        }),
      })
      // R14-16: 非JSONレスポンス対策
      if (!res.ok && res.status !== 409) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      // R14-02: セット切替後のstale write防止
      if (selectedSetRef.current?.id !== capturedSetId) return false
      if (json.success) {
        setRegistered(prev => ({ ...prev, [card.id]: true }))
        setCheckedCards(prev => {
          const next = new Set(prev)
          next.delete(card.id)
          return next
        })
        return true
      } else {
        setRegisterError(prev => ({ ...prev, [card.id]: json.error || '登録失敗' }))
        if (res.status === 409) {
          setRegistered(prev => ({ ...prev, [card.id]: true }))
          return true // 既に登録済み
        }
        return false
      }
    } catch (e: unknown) {
      if (selectedSetRef.current?.id !== capturedSetId) return false
      const message = e instanceof Error ? e.message : '登録エラー'
      setRegisterError(prev => ({ ...prev, [card.id]: message }))
      return false
    } finally {
      if (selectedSetRef.current?.id === capturedSetId) {
        setRegistering(prev => ({ ...prev, [card.id]: false }))
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
    const capturedSetId = selectedSetRef.current?.id // R12-13: セットIDを捕捉
    try {
      // R13-INT07: jaNameが未入力のカードもスキップ（日本語名なし登録防止）
      const toRegister = cardsRef.current.filter(c =>
        checkedCardsRef.current.has(c.id) && !registeredRef.current[c.id] && jaNamesRef.current[c.id]?.trim()
      )
      // R14-03: 空配列の早期リターン（UIチラつき防止）
      if (toRegister.length === 0) return
      cancelBulkRef.current = false
      let succeeded = 0
      let failed = 0
      setBulkProgress({ current: 0, total: toRegister.length, succeeded: 0, failed: 0 })
      for (let i = 0; i < toRegister.length; i++) {
        if (cancelBulkRef.current) break
        // レート制限対策: 2件目以降は5.5秒待機（サーバー側5秒制限）
        if (i > 0) await new Promise(r => setTimeout(r, 5500))
        if (cancelBulkRef.current) break
        const ok = await handleRegister(toRegister[i])
        if (ok) succeeded++
        else failed++
        setBulkProgress({ current: i + 1, total: toRegister.length, succeeded, failed })
      }
      // R12-13: セット切替後はクリアをスキップ（新セットのprogressを消さない）
      if (selectedSetRef.current?.id === capturedSetId) {
        setBulkProgress(null)
      }
    } finally {
      bulkRunningRef.current = false
    }
  }, [handleRegister])

  const cancelBulkRegister = useCallback(() => {
    cancelBulkRef.current = true
  }, [])

  const checkedCount = checkedCards.size
  const readyCount = useMemo(() =>
    cards.filter(c => checkedCards.has(c.id) && jaNames[c.id]?.trim() && !registered[c.id]).length
  , [cards, checkedCards, jaNames, registered])

  return {
    checkedCards,
    jaNames,
    registering,
    registered,
    registerError,
    checkedCount,
    readyCount,
    bulkProgress,
    expansionOverride,
    defaultExpansion,
    setExpansionOverride,
    toggleCheck,
    toggleAllFiltered,
    setJaName,
    handleRegister,
    handleBulkRegister,
    cancelBulkRegister,
  }
}

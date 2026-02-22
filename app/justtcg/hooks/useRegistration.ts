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
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)

  // セット切替時にステートをリセット（registeredは保持しない — 別セットのIDなので無意味）
  const prevSetId = useRef(selectedSet?.id)
  useEffect(() => {
    if (selectedSet?.id !== prevSetId.current) {
      prevSetId.current = selectedSet?.id
      setCheckedCards(new Set())
      setJaNames({})
      setRegistering({})
      setRegistered({})
      setRegisterError({})
      setBulkProgress(null)
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
      const allChecked = filteredIds.every(id => prev.has(id))
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

  // ref で最新値を保持し、useCallback の deps から除外（stale closure 防止）
  const jaNamesRef = useRef(jaNames)
  jaNamesRef.current = jaNames
  const pcMatchesRef = useRef(pcMatches)
  pcMatchesRef.current = pcMatches
  const selectedSetRef = useRef(selectedSet)
  selectedSetRef.current = selectedSet
  const selectedGameRef = useRef(selectedGame)
  selectedGameRef.current = selectedGame

  const handleRegister = useCallback(async (card: JTCard) => {
    const jaName = jaNamesRef.current[card.id]?.trim()
    if (!jaName) {
      setRegisterError(prev => ({ ...prev, [card.id]: '日本語名を入力してください' }))
      return
    }
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
          expansion: currentSet ? getSetNameJa(currentSet.id, currentSet.name) : card.set_name,
          image_url: pc?.imageUrl || null,
          justtcg_id: card.id,
          tcgplayer_id: card.variants?.[0]?.id || null,
          pricecharting_id: pc?.id || null,
          pricecharting_url: pc?.pricechartingUrl || null,
          game: selectedGameRef.current,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setRegistered(prev => ({ ...prev, [card.id]: true }))
        setCheckedCards(prev => {
          const next = new Set(prev)
          next.delete(card.id)
          return next
        })
      } else {
        setRegisterError(prev => ({ ...prev, [card.id]: json.error || '登録失敗' }))
        if (res.status === 409) {
          setRegistered(prev => ({ ...prev, [card.id]: true }))
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '登録エラー'
      setRegisterError(prev => ({ ...prev, [card.id]: message }))
    } finally {
      setRegistering(prev => ({ ...prev, [card.id]: false }))
    }
  }, [])

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const checkedCardsRef = useRef(checkedCards)
  checkedCardsRef.current = checkedCards
  const registeredRef = useRef(registered)
  registeredRef.current = registered

  const handleBulkRegister = useCallback(async () => {
    const toRegister = cardsRef.current.filter(c => checkedCardsRef.current.has(c.id) && !registeredRef.current[c.id])
    setBulkProgress({ current: 0, total: toRegister.length })
    for (let i = 0; i < toRegister.length; i++) {
      setBulkProgress({ current: i + 1, total: toRegister.length })
      await handleRegister(toRegister[i])
    }
    setBulkProgress(null)
  }, [handleRegister])

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
    toggleCheck,
    toggleAllFiltered,
    setJaName,
    handleRegister,
    handleBulkRegister,
  }
}

import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// カテゴリ（大）を取得
export function useCategoryLarge() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('category_large')
        .select('*')
        .order('sort_order')
      if (data) setData(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  return { data, loading }
}

// カード一覧を取得
export function useCards() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setData(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  return { data, loading }
}

// 買取店舗を取得
export function usePurchaseShops() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('purchase_shops')
        .select('*')
        .order('created_at')
      if (data) setData(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  return { data, loading }
}

// レアリティを取得（カテゴリ別）
export function useRarities(largeId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!largeId) {
        setData([])
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('rarities')
        .select('*')
        .eq('large_id', largeId)
        .order('sort_order')
      if (data) setData(data)
      setLoading(false)
    }
    fetchData()
  }, [largeId])

  return { data, loading }
}
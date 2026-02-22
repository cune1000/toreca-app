'use client'

import { memo } from 'react'
import { RARITY_COLORS } from '../lib/constants'

export default memo(function RarityBadge({ rarity }: { rarity: string }) {
  if (!rarity || rarity === 'None') return null

  const colors = RARITY_COLORS[rarity] || { bg: 'bg-gray-100', text: 'text-gray-500' }

  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-[0.25rem] ${colors.bg} ${colors.text}`}>
      {rarity}
    </span>
  )
})

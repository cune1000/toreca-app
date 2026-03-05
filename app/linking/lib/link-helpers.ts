import type { ExternalItem } from './types'

/** 紐づけAPIのリクエストボディを構築 */
export function buildLinkBody(source: string, item: ExternalItem, cardId: string, condition?: string): Record<string, unknown> {
  const cond = condition && condition !== 'normal' ? { label: condition, condition } : {}
  switch (source) {
    case 'snkrdunk': return { cardId, apparelId: (item.meta as any).apparelId }
    case 'shinsoku': return { cardId, itemId: (item.meta as any).itemId, ...cond }
    case 'lounge': return { cardId, cardKey: (item.meta as any).cardKey, ...cond }
    default: throw new Error(`Unknown source: ${source}`)
  }
}

/** 紐づけ解除APIのリクエストボディを構築 */
export function buildUnlinkBody(source: string, item: ExternalItem): Record<string, unknown> {
  switch (source) {
    case 'snkrdunk': return { apparelId: (item.meta as any).apparelId }
    case 'shinsoku': return { itemId: (item.meta as any).itemId }
    case 'lounge': return { cardKey: (item.meta as any).cardKey }
    default: throw new Error(`Unknown source: ${source}`)
  }
}

/** ソースごとの紐づけAPIエンドポイント */
export function getLinkEndpoint(source: string): string {
  return `/api/linking/${source}/link`
}

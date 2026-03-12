# Devil's Advocate Reviewer - Memory

## Project Structure (confirmed)
- Next.js 16 App Router + Supabase + Tailwind CSS 4
- v1 DB: 4-layer category hierarchy (category_large > medium > small > detail)
- v2 DB: 3-layer via CHECK constraint (game_type > series > set) - docs/v2-db-schema.sql
- JustTCG API: Pro plan, params confirmed: `include_price_history`, `priceHistoryDuration` (7d/30d/90d/180d)
- Supported games (v2): pokemon-japan, one-piece-card-game only

## Recurring Issues Found
- **ALLOWED_GRADES triplicated**: `['A','B','PSA10','PSA9','1個']` in page.tsx (x2) + SnkrdunkTab.tsx (x1). Should be in constants.ts.
- **Inconsistent VALID_GAMES across routes**: sets route has 7 games, cards route has 2, register route has 7 in GAME_CATEGORY_MAP
- **Supabase JOIN alias collision**: `rarity:rarity_id(id, name)` overwrites `cards.rarity` column (rarity_id deprecated 2026-03)
- **isSameTransaction + extractIconNumber duplicated**: in snkrdunk-sync AND snkrdunk-scrape
- **formatRelativeTime duplicated**: constants.ts (Japanese) vs cron/page.tsx (English)
- **admin/cron route has NO authentication**: GET/POST both unprotected

## Performance Issues Found & Fixed (2026-03-09)
- **N+1 UPDATE in justtcg-price-sync** -> FIXED: batch parallel 10 at a time
- **select('*') in 29+ API routes** -> Partially fixed (snkrdunk-sales, overseas-prices, category_large)
- **No .limit() on rankings queries** -> FIXED: added limit(10000)
- **Dashboard search unlimited sales fetch** -> FIXED: grade filter + limit(100/50)
- **chart/card/[id] sequential queries** -> FIXED: Promise.all parallelization (4 queries)
- **image-proxy no size limit** -> FIXED: 10MB limit + 7-day cache
- **snkrdunk_chart_data limit(10000)** -> FIXED: reduced to limit(3000)
- **Module-scope createServiceClient()**: 11 files still affected (linking/*, snkrdunk-chart, snkrdunk-scrape)

## Remaining Performance Concerns (not yet fixed)
- overseas-price-sync: still 1-by-1 INSERT per card (same pattern as old justtcg N+1)
- Card detail page: 16 useState, 6+ parallel fetch on mount, ~30 `any` types
- select('*') still in: pos/*, admin/cron, grid-templates, price-index, shinsoku/search, toreca-lounge/search
- Recharts full bundle imported (no tree shaking for LineChart/AreaChart)

## Cron Architecture (confirmed 2026-03)
- **snkrdunk-sync**: maxDuration=300, BATCH_SIZE=15, NO timeout guard
- **justtcg-price-sync**: maxDuration=300, 270s timeout, N+1 UPDATE FIXED
- **snkrdunk-sync does NOT write to cron_logs**
- **top_prices column detection via error**: catches INSERT error code 42703

## Key File Paths
- `app/api/cron/snkrdunk-sync/route.ts` - Snkrdunk unified cron
- `app/api/cron/justtcg-price-sync/route.ts` - JustTCG daily price sync
- `app/api/cron/overseas-price-sync/route.ts` - PriceCharting overseas price sync
- `app/api/admin/cron/route.ts` - Admin cron trigger (NO AUTH)
- `app/cards/[id]/page.tsx` - Card detail God Component (620+ lines)
- `lib/api/dashboard.ts` - Dashboard data fetching functions

## Patterns & Anti-Patterns
- **Error-based column detection**: catches INSERT error to detect missing `top_prices` column
- **TypeScript strict: false**: type mismatches won't surface as compile errors
- **any abuse in page.tsx**: ~30+ occurrences despite lib/types.ts having 300+ lines of type defs
- **CardEditForm & CardForm ~80% duplicated**: Should extract shared CardFormBase
- **Rarity triple-source**: cards.rarity (text) + cards.rarity_id (FK) + rarity-mapping.ts (display)

## Rarity Migration Review (2026-03-10)
- rarity_id -> cards.rarity text migration IN PROGRESS but incomplete
- **CRITICAL**: cards.rarity stores inconsistent formats: EN full names ("Illustration Rare") from API register vs JA short names ("AR") from manual forms
- **CRITICAL**: RPC functions (aggregate_snkrdunk_sales, aggregate_purchase_prices) still JOIN rarities table via rarity_id
- Dead code remaining: getRarityShortName(), SHORT_TO_DISPLAY, useRarities(), TABLES.RARITIES, Rarity type (categories.ts)
- lib/types.ts Card.rarity_id and CardWithRelations.rarities still in type defs
- CardDetailHeader.tsx has dead fallback: `card.rarities || card.rarity` (rarities never populated)
- CategoryManager still CRUDs rarities table but it no longer connects to card registration
- Need: normalizeRarity() in register APIs + data migration to unify existing values

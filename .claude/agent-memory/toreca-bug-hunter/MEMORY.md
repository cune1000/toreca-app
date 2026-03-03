# Toreca Bug Hunter - Agent Memory

## Project Structure (JustTCG API Integration)

### Game Validation Points (keep in sync)
When changing supported games, ALL of these must be updated together:
1. `app/justtcg/lib/constants.ts` - GAME_OPTIONS (frontend dropdown)
2. `app/api/justtcg/cards/route.ts` - VALID_GAMES
3. `app/api/justtcg/sets/route.ts` - VALID_GAMES
4. `app/api/justtcg/match/route.ts` - JAPANESE_GAMES
5. `app/api/justtcg/register/route.ts` - GAME_CATEGORY_MAP
6. `docs/v2-db-schema.sql` - valid_game_types() function

### Rarity Mappings (keep in sync)
- `app/api/justtcg/register/route.ts` - RARITY_EN_TO_JA (28 entries)
- `app/justtcg/lib/constants.ts` - RARITY_COLORS (visual only)
- `docs/v2-db-schema.sql` - rarity_mappings INSERT (27 Pokemon + 7 One Piece)
- Known gap: 'Art Rare' in v2 schema but not in RARITY_EN_TO_JA

### Chart Categories (keep in sync)
- `lib/chart/constants.ts` - CATEGORIES array + CATEGORY_SLUG_MAP
- `app/api/chart/rankings/route.ts` - uses CATEGORY_SLUG_MAP
- `app/api/chart/search/route.ts` - uses CATEGORY_SLUG_MAP
- Category tab state is URL-based (not localStorage) for chart pages

### JustTCG API Parameters (verified Feb 2026)
- `include_price_history: 'true'` - correct param name (boolean string)
- `priceHistoryDuration: '180d'` - correct param name (7d/30d/90d/180d)
- Source: JustTCG official blog

### localStorage Keys
- `jtcg-selectedGame` - JustTCG Explorer game selection
- `chart_rankings_v3` - Chart ranking visibility settings (RANKING_STORAGE_KEY)
- No localStorage for chart category selection (URL-based)

## Cron Architecture (verified Feb 2026)

### Dual Scheduling System in card_sale_urls
- `next_scrape_at` / `last_scraped_at` / `last_scrape_status` / `last_scrape_error`: Used by snkrdunk-sync
- `next_check_at` / `last_checked_at` / `check_interval` / `error_count`: Used by update-prices
- CRITICAL: When skipping snkrdunk in update-prices, exclude at QUERY level (.not('product_url','like','%snkrdunk.com%')), not application level

### sale_prices table
- `top_prices` column: NOT in any migration but used in code with 42703 fallback pattern
- Confirmed columns: card_id, site_id, price, stock, grade

### snkrdunk API timing per card
- getProductInfo(1 call) + getSalesHistory(1 call) + getAllListings(up to 5 pages + 500ms waits)
- Realistic ~15s/card; BATCH_SIZE=15 needs ~225s > maxDuration=120

## Category Migration Status (2026-03, updated full audit)
v1 category system (category_large + rarities tables) still actively used in UI.
Replaced by JustTCG-based: set_code, expansion.
Remaining references: see [category-migration.md](./category-migration.md)

### Frontend v1 references (category_large / rarities table queries):
- `components/pages/CardsPage.tsx` L289-299, L366, L374-391, L617-619, L876
- `components/pages/ShopDetailPage.tsx` L66-67, L77-78, L102-109
- `components/CardForm.tsx` L63, L102-110, L197-198
- `components/CardEditForm.tsx` L47, L93-97, L435-436
- `components/PriceChartingImporter.tsx` L54, L98, L289
- `app/cards/[id]/page.tsx` L60, L132 (category_large JOIN)
- `components/DashboardContent.tsx` L77 (fetches but never displays)

### Backend v1 references (not audited this session):
- `lib/api/cards.ts` getCards/getCard - old JOINs
- `app/api/cards/batch-update/route.ts` - old allowedFields
- `app/api/public/cards/route.ts` - category_medium JOIN + sub_category
- `app/api/cron/daily-price-aggregate/route.ts` - category_medium usage
- `app/api/pos/catalog/search-api/route.ts` - category_medium_id SELECT

### UI bugs found in audit (2026-03):
- DashboardContent.tsx L164: grid-cols-4 with 3 children
- ShopDetailPage.tsx L276: md:grid-cols-4 with 3 children
- CardForm.tsx L168: stale closure in async onload (form spread)
- CardEditForm.tsx L157: same stale closure bug
- Old terminology in labels: CardForm L384, CardEditForm L450, PriceChartingImporter L426

## Linking Page Bugs (2026-03 audit)
See [linking-bugs.md](./linking-bugs.md) for full details.
Key findings:
- pagination.total wrong when linked/unlinked filter active (JS-side filter after DB pagination)
- ilike pattern injection (% and _ not escaped in search inputs)
- useLinkingState debounce ineffective (search in fetchItems deps fires immediately)
- useAutoMatch lacks AbortController (race condition on quick item switching)
- snkrdunk link upsert onConflict:'card_id,site_id' overwrites existing links
- Timer cleanup missing on unmount (useCardSearch, useLinkingState)
- No auth on any linking API route (all use service role client)
- RightPanel overlay missing position:relative on parent
- stats.linked/unlinked counts only current page items vs total from DB
- snkrdunk_items_cache table has no migration file in supabase/migrations/

## Debugging Patterns Found
- API routes use different validation sets - easy to miss one when updating
- Frontend GAME_OPTIONS uses `as const` for type safety but selectedGame is `string` (from localStorage)
- register route has TOCTOU race condition handling for duplicate justtcg_id (23505 error fallback)
- Supabase .insert()/.update() errors silently ignored in multiple cron routes - always destructure { error }
- cron-gate.ts: if cron_schedules row missing, defaults to allowing execution
- handleCardUpdated can diverge from initial fetch query in card detail page - always check both

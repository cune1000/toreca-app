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

### Rarity System (2026-03-10 refactored)
- **Canonical source**: `lib/rarity-mapping.ts` - RARITY_EN_TO_JA (35 entries), normalizeRarityForDb()
- **DB convention**: Short names only (SAR, RR, コモン etc.) — NOT English full names
- **Normalization**: Both register routes (justtcg, tcgapi) call normalizeRarityForDb() before DB save
- **Display**: getRarityDisplayName() converts DB values → display labels
- **Colors**: `app/justtcg/lib/constants.ts` - RARITY_COLORS (both English + short name keys)
- **Migration**: `docs/migrations/002_normalize_rarity_values.sql` (run manually to fix existing data)
- Known non-standard DB values: BOX, その他, デッキ, パック (intentionally left as-is)

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

## Cron Bug Audit (2026-03-08)
See [cron-bugs.md](./cron-bugs.md) for full details.
Key findings:
- sale_prices has NO unique constraint → duplicate data accumulates every 5min sync
- card_sale_urls missing product_type column → getProductInfo called every time
- justtcg-price-sync: no pagination → large sets partially synced (FIXED: pagination added)
- admin/cron manual trigger missing ?force=1
- daily-price-aggregate depends on v1 category system
- snkrdunk-items-sync hardcodes brandId='pokemon'
- maxDuration now 300 (was 120), BATCH_SIZE=15 fits within limit

## Chart Data Granularity Bug (2026-03-09, FIXED)
- Card detail PriceChartTab: overseas/justTcg lines appeared flat because of timestamp granularity mismatch
- sale_prices used minute-level timestamps (200 points), overseas/justTcg used dayNoon (30 points)
- Recharts XAxis = category axis (no type="number") → equal spacing → daily data compressed to left 13%
- Fix: `roundTimestamp()` function in chartData useMemo — when period > 7 days, all sources use dayNoon bucketing
- File: `app/cards/[id]/page.tsx` L242-259
- Note: 7-day period still uses minute-level for intraday detail (overseas has only 7 daily points in this range)

## kaitori-app Bug Audit (2026-03-09)
See [kaitori-bugs.md](./kaitori-bugs.md) in kaitori-app/.claude/agent-memory/ for full details.
Key findings (27 bugs total):
- market_prices has NO unique constraint → duplicate data every cron run (same pattern as toreca-app sale_prices)
- Supabase 1000-row limit missing on 9+ queries
- `?manual=true` bypasses cron auth completely
- cron-gate.ts implemented but never called from either cron route
- PATCH routes spread `...body` into update → arbitrary column overwrite
- Parent sheet deletion orphans child pages (ON DELETE SET NULL)
- ilike pattern injection in card search
- Multiple .insert() results not checked for errors
- Card position swap has no error handling (can leave position=-1)
- snkrdunk-sync has massive code duplication (stream vs batch, 80 lines x2)

## Cron Route Refactoring (2026-03-09)
Applied to all 11 cron routes:
- **Module-scope supabase removed**: lounge-cache, shinsoku, shinsoku-sync, snkrdunk-chart-sync, snkrdunk-items-sync, snkrdunk-sync, toreca-lounge all had `const supabase = createServiceClient()` at module scope → moved inside GET handler
- **catch blocks hardened**: All `error: any` → `error: unknown` with `instanceof Error` check; all `markCronJobRun` in catch blocks wrapped in try-catch to prevent double-fault
- **`.limit()` added**: justtcg-price-sync inner existingSet query, snkrdunk-sync existingData query
- **Unused imports removed**: shinsoku-sync had unused `toYen` import
- **shinsoku-sync**: Added top-level try-catch (was missing — `markCronJobRun` could throw uncaught)
- **Type improvements**: Replaced `any[]` with typed interfaces for inserts/results in daily-price-aggregate, shinsoku, toreca-lounge, snkrdunk-sync
- **Supabase query builder `.catch()` doesn't exist**: Use try-catch blocks instead (found in lounge-cache)

## Data Flow Integrity Audit (2026-03-09)
Key fixes applied:
- **toreca-lounge**: Added diff check (was inserting purchase_prices every run regardless of price change)
- **shinsoku conditionToPriceMap**: '素体' was mapped to price_s (sealed) → fixed to price_a
- **snkrdunk-chart-sync**: Now reads product_type from card_sale_urls to skip getProductInfo API call
- **card detail limit**: sale_prices/purchase_prices limit 200→2000 (200 only covered ~3 days of data)
Remaining items (not fixed, low priority):
- overseas-prices/update inserts exchange_rates every manual call (no dedup)
- overseas_prices has no unique constraint (chain call date rollover could duplicate)
- chartData roundTimestamp uses client locale (works for JP users only)
- daily-price-aggregate still depends on v1 category system

## Security Audit (2026-03-09)
See [security-audit.md](./security-audit.md) for full details.
Key fixes applied:
- **admin/cron SSRF**: Added path prefix restriction (`/api/cron/` only) + traversal prevention
- **twitter route**: Added CRON_SECRET auth (was exposing X API Bearer Token)
- **twitter/monitor**: Added Authorization header to internal twitter route call
- **pokemon-card-scrape SSRF**: Added URL allowlist (pokemon-card.com only)
- **gemini/classify SSRF**: Added image URL domain allowlist (pbs.twimg.com only)
- **Module-scope supabase**: Removed from 10 non-cron routes (snkrdunk-scrape, snkrdunk-chart, linking/*)
- **ilike injection**: Added escape for `%_\,()` in 7 routes + buildKanaSearchFilter utility
Key remaining issues (reported only, not fixed):
- No user auth system — all API routes accessible to anyone who knows the URL
- No rate limiting on most routes (only justtcg/register has basic IP rate limit)
- No CORS restrictions (Next.js default)
- POS routes use anon key (RLS-dependent security)
- Error messages leak internal details (Supabase error messages exposed to client)

## Supabase max_rows=1000 問題 (2026-03-10, FIXED)
- Supabaseプロジェクトの max_rows 設定が 1000 → `.limit(10000)` を指定してもサーバー側で1000行に切り詰められる
- `.order('rarity')` + 1000行上限 → アルファベット後半のレアリティ(SAR,SR,RRR,UR等)が欠落
- 影響箇所: CardEditForm, CardForm, CardsPage の rarity/expansion 取得クエリ
- 修正: `.range(offset, offset+999)` でページネーション、全行取得後にJS側でユニーク化
- RARITY_EN_TO_JA に 'Mega Attack Rare' → 'MAR' を追加
- DB内の全レアリティ値(23種): Amazing Rare, Art Rare, BOX, Black White Rare, Character Rare, Character Super Rare, Common, Double Rare, Hyper Rare, Kagayaku, Mega Attack Rare, Mega Ultra Rare, None, Promo, Shiny Rare, Shiny Secret Rare, Special Art Rare, Super Rare, Triple Rare, Ultra Rare, その他, デッキ, パック

## RLS Issues (2026-03-09)
- `justtcg_price_history` table likely has RLS enabled with NO select policy → anon key reads return empty
  - Cron writes with service role (bypasses RLS) → data exists in DB
  - Frontend reads with anon key → blocked by RLS → chart shows nothing
  - Same pattern was fixed for overseas_prices/exchange_rates/snkrdunk_sales_history in 20260218_fix_rls_policies.sql
  - Fix: ALTER TABLE justtcg_price_history DISABLE ROW LEVEL SECURITY;
  - Verify: SELECT relrowsecurity FROM pg_class WHERE relname='justtcg_price_history'

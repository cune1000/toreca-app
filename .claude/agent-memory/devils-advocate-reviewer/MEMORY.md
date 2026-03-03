# Devil's Advocate Reviewer - Memory

## Project Structure (confirmed)
- Next.js 16 App Router + Supabase + Tailwind CSS 4
- v1 DB: 4-layer category hierarchy (category_large > medium > small > detail)
- v2 DB: 3-layer via CHECK constraint (game_type > series > set) - docs/v2-db-schema.sql
- JustTCG API: Pro plan, params confirmed: `include_price_history`, `priceHistoryDuration` (7d/30d/90d/180d)
- Supported games (v2): pokemon-japan, one-piece-card-game only

## Recurring Issues Found
- **Inconsistent VALID_GAMES across routes**: sets route has 7 games, cards route has 2, register route has 7 in GAME_CATEGORY_MAP. See [consistency-issues.md](./consistency-issues.md)
- **RARITY_EN_TO_JA divergence**: See prior notes
- **Supabase client patterns**: CardPriceDisplay.tsx creates a global supabase client at module scope (anti-pattern for SSR)
- **Supabase JOIN alias collision**: `rarity:rarity_id(id, name)` overwrites `cards.rarity` column. Recommend `rarity_rel` suffix.

## UI/UX Migration Issues (2026-03 review) -> [ui-migration-issues.md](./ui-migration-issues.md)
- Label inconsistency "カテゴリ" vs "ゲーム" in ShopDetailPage, PriceChartingImporter
- Dual rarity input (text + FK) causes display mismatch across screens
- Form field order mismatch between CardsPage table and CardEditForm
- CardForm missing set_code field and drag&drop
- Image fallback inconsistency across 3 screens
- ShopDetailPage grid cols mismatch and purchase count bug

## Cron Architecture (confirmed 2026-02)
- **Dual scheduling columns in card_sale_urls**: `next_scrape_at`/`last_scraped_at` (snkrdunk-sync) vs `next_check_at`/`last_checked_at` (update-prices)
- **snkrdunk-sync ignores auto_scrape_mode** but UI (SnkrdunkMonitorPage, SettingsTab) still references it
- **snkrdunk-auto-scrape (old)**: file exists but NOT in vercel.json -- should be deleted
- **Duplicated helpers**: isSameTransaction & extractIconNumber in both sync routes (should be in lib/scraping/helpers.ts)
- **snkrdunk-sync does NOT write to cron_logs** (update-prices does via logCronResult)
- **maxDuration=180s with BATCH_SIZE=10**: risky -- each card up to 7 API calls x 15s timeout
- **No isRestTime check in snkrdunk-sync** (update-prices has it)
- **CronDashboard orders by next_check_at** but snkrdunk-sync only updates next_scrape_at

## Linking Page Issues (2026-03 review) -> [linking-review.md](./linking-review.md)
- **CRITICAL: linkFilter JS-side post-pagination** breaks page counts (C1)
- **CRITICAL: No auth on link API endpoints** (C2)
- **3 page files 99% copy-paste** → extract LinkingPageShell or use [source] dynamic route (Y1)
- **6 API routes also copy-paste** → unify with [source] param (Y2)
- **Double API call on search**: search state change fires fetchItems immediately + debounced page reset fires again (Y5)
- **checkedItems persist across pages** but bulk only processes current page items (Y6)
- **stats.linked/unlinked from current page only** vs total from DB (Y7)
- **ExternalItemRow memo broken**: inline arrow callbacks in CenterPanel (S4)
- **buildLinkBody duplicated** in RightPanel.tsx and useBulkLinking.ts (C4)
- **RightPanel absolute overlay missing position:relative** on parent (C5)
- **alert() for errors** instead of state-managed banners (S6)
- **shop_id queried by name every request** (Y3)
- **Module-scope createServiceClient()** in all 6 API routes (Y10)

## Key File Paths
- `lib/snkrdunk-api.ts` - Snkrdunk API client
- `lib/scraping/helpers.ts` - parseRelativeTime, normalizeGrade, extractGradePrices
- `app/api/cron/snkrdunk-sync/route.ts` - NEW unified snkrdunk cron
- `app/api/cron/snkrdunk-auto-scrape/route.ts` - OLD (to be deleted)
- `app/api/cron/update-prices/route.ts` - Non-snkrdunk price updates
- `components/pages/SnkrdunkMonitorPage.tsx` - Snkrdunk monitoring UI
- `components/card-detail/SettingsTab.tsx` - Per-card settings UI
- `components/CronDashboard.tsx` - Cron management dashboard
- `components/CategoryManager.tsx` - Dead code (removed from sidebar, file still exists)

## Patterns & Anti-Patterns
- **N+1 inserts**: snkrdunk-sync inserts sales one-by-one instead of bulk
- **Error-based column detection**: catches INSERT error to detect missing `top_prices` column
- **TypeScript strict: false**: type mismatches won't surface as compile errors
- **CardEditForm & CardForm ~80% duplicated**: Should extract shared CardFormBase component
- **Rarity triple-source**: cards.rarity (text) + cards.rarity_id (FK) + rarity-mapping.ts (display)

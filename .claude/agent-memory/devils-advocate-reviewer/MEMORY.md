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
- **RARITY_EN_TO_JA divergence**: See prior notes
- **Supabase client patterns**: snkrdunk-sync creates global supabase at module scope; justtcg-price-sync does it inside handler (correct)
- **Supabase JOIN alias collision**: `rarity:rarity_id(id, name)` overwrites `cards.rarity` column. Recommend `rarity_rel` suffix.
- **isSameTransaction + extractIconNumber duplicated**: in snkrdunk-sync AND snkrdunk-scrape. Should be in lib/scraping/helpers.ts.
- **formatRelativeTime duplicated**: constants.ts (Japanese) vs cron/page.tsx (English)
- **admin/cron route has NO authentication**: GET/POST both unprotected

## UI/UX Migration Issues (2026-03 review) -> [ui-migration-issues.md](./ui-migration-issues.md)
- Label inconsistency, dual rarity input, form field order mismatch, image fallback inconsistency

## Cron Architecture (confirmed 2026-03)
- **Dual scheduling columns in card_sale_urls**: `next_scrape_at`/`last_scraped_at` vs `next_check_at`/`last_checked_at`
- **snkrdunk-sync**: maxDuration=300, BATCH_SIZE=15, NO timeout guard, JSDoc says "最大5カード" (stale)
- **justtcg-price-sync**: maxDuration=300, has 270s timeout guard, N+1 UPDATE on cards table
- **snkrdunk-sync ignores auto_scrape_mode** but UI still references it
- **Duplicated helpers**: isSameTransaction & extractIconNumber (confirmed still duplicated 2026-03)
- **top_prices column detection via error**: catches INSERT error code 42703
- **snkrdunk-sync does NOT write to cron_logs**

## Linking Page Issues (2026-03 review) -> [linking-review.md](./linking-review.md)
- CRITICAL: linkFilter JS-side post-pagination, No auth on link API endpoints
- 3 page files + 6 API routes copy-paste, module-scope createServiceClient()

## Key File Paths
- `app/api/cron/snkrdunk-sync/route.ts` - Snkrdunk unified cron
- `app/api/cron/justtcg-price-sync/route.ts` - JustTCG daily price sync
- `app/api/admin/cron/route.ts` - Admin cron trigger (NO AUTH)
- `app/cron/page.tsx` - Cron dashboard UI
- `app/cards/[id]/page.tsx` - Card detail God Component (580 lines, 16 useState, ~30 `any`)
- `components/card-detail/constants.ts` - Chart colors, grade configs
- `components/card-detail/PriceChartTab.tsx` - Price chart component
- `components/card-detail/SnkrdunkTab.tsx` - Snkrdunk sales tab
- `lib/scraping/helpers.ts` - Shared scraping parsers

## Patterns & Anti-Patterns
- **N+1 updates**: justtcg-price-sync updates cards.justtcg_nm_price_usd one-by-one
- **Error-based column detection**: catches INSERT error to detect missing `top_prices` column
- **TypeScript strict: false**: type mismatches won't surface as compile errors
- **any abuse in page.tsx**: ~30+ occurrences despite lib/types.ts having 300+ lines of type defs
- **CardEditForm & CardForm ~80% duplicated**: Should extract shared CardFormBase
- **Rarity triple-source**: cards.rarity (text) + cards.rarity_id (FK) + rarity-mapping.ts (display)

# Category Migration Gaps (v1 4-layer -> JustTCG-based)

Last updated: 2026-03-01

## Files that still reference category_medium/small/detail

### HIGH priority (user-facing, actively broken or inconsistent)
1. `components/CardForm.tsx` - Full old 4-layer UI (medium/small selects, getMediumCategories/getSmallCategories imports)
2. `lib/api/cards.ts:getCard()` - JOINs category_medium/small/detail
3. `lib/api/cards.ts:getCards()` - JOINs category_detail
4. `app/cards/[id]/page.tsx:handleCardUpdated()` - JOINs all 4 layers (but initial fetch is already fixed)

### MEDIUM priority (API/cron, may cause data inconsistency)
5. `app/api/public/cards/route.ts` - JOINs category_medium, returns sub_category in response (API compat concern)
6. `app/api/cards/batch-update/route.ts` - allowedFields includes medium/small/detail IDs
7. `components/pages/ShopDetailPage.tsx` - Queries category_medium/small tables, filters by medium/small IDs
8. `app/api/cron/daily-price-aggregate/route.ts` - Queries category_medium table, uses category_medium_id

### LOW priority (type/constant definitions, can coexist)
9. `lib/types.ts` Card interface - category_medium_id/small_id/detail_id still in type
10. `lib/supabase.ts` TABLES constant - CATEGORY_MEDIUM/SMALL/DETAIL entries
11. `lib/api/categories.ts` - getMediumCategories/getSmallCategories functions
12. `app/api/pos/catalog/search-api/route.ts` - uses category_medium_id in select

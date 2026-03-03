# Category Migration: v1 -> JustTCG-based

## Status: In Progress (2026-03, audit updated 2026-03-01)

## Completed Files (confirmed clean)
- `lib/api/cards.ts` - getCards/getCard/addCard/updateCard: category_large only
- `app/cards/[id]/page.tsx` - fetchCard + handleCardUpdated: category_large only (lines 60, 132)
- `app/api/public/cards/route.ts` - category_large only
- `components/pages/ShopDetailPage.tsx` - category_large only
- `components/pages/CardsPage.tsx` - category_large only
- `components/CardEditForm.tsx` - medium/small removed
- `components/card-detail/CardDetailHeader.tsx` - uses getRarityDisplayName
- `components/CardForm.tsx` - category_large_id only (no medium/small/detail)
- `app/api/justtcg/register/route.ts` - uses lib/rarity-mapping.ts
- `lib/rarity-mapping.ts` - new file, extracted rarity utilities

## Remaining References (by priority) - Audit 2026-03-01

### P0 CRITICAL (cron/API will break if category_medium table/column dropped)
1. `app/api/cron/daily-price-aggregate/route.ts:65-93`
   - Lines 65-67: SELECT from category_medium table
   - Lines 73,77: categoryMediumMap building
   - Line 84: SELECT category_medium_id from cards
   - Lines 86-92: catMediumId mapping
   - Lines 117-119,177-179: sub_category = categoryMediumMap lookup
   - FIX: Remove medium queries, set sub_category='ALL'. Note: daily_price_index onConflict includes sub_category
2. `app/api/pos/catalog/search-api/route.ts:32`
   - SELECT includes category_medium_id (unused in response mapping)
   - FIX: Remove category_medium_id from .select()

### P1 HIGH (dead code that queries deleted tables)
3. `lib/api/categories.ts:57-86,110-111,221-233`
   - getMediumCategories(), getSmallCategories(), getMediumAndRarities() functions
   - TABLE_MAP/PARENT_FIELD_MAP entries for medium/small
   - CategoryMedium, CategorySmall interfaces (lines 14-26)
4. `components/CategoryManager.tsx:6-7,64,72`
   - Imports and calls getMediumCategories, getSmallCategories
   - Full 4-layer category management UI still present
5. `lib/api/index.ts:56-57,63`
   - Barrel exports: getMediumCategories, getSmallCategories, getMediumAndRarities

### P2 MEDIUM (type cleanup, no runtime crash)
6. `lib/types.ts:17-19` - Card interface: category_medium_id, category_small_id, category_detail_id
7. `lib/types.ts:205-224` - CategoryMedium, CategorySmall, CategoryDetail interfaces
8. `lib/supabase.ts:112-114` - TABLES: CATEGORY_MEDIUM, CATEGORY_SMALL, CATEGORY_DETAIL
9. `app/api/cards/batch-update/route.ts:14-15` - JSDoc comments only (allowedFields is correct)

### P3 LOW (docs/migrations)
10. `supabase/migrations/truncate_all_data.sql:24-26` - old tables in TRUNCATE list
11. `CLAUDE.md:99` - 4-level category hierarchy description

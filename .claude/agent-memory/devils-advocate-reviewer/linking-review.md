# Linking Page Detailed Review Notes (2026-03-03)

## Architecture
- 3 source pages: snkrdunk, shinsoku, lounge (app/linking/{source}/page.tsx)
- 6 API routes: 3 items + 3 link (app/api/linking/{source}/{items,link}/route.ts)
- Shared: hooks (useLinkingState, useCardSearch, useAutoMatch, useBulkLinking), components (LeftPanel, CenterPanel, RightPanel, ExternalItemRow, CardSearchResult), lib (types, constants, matching)
- Pattern modeled after JustTCG Explorer but with key divergences

## Critical Issues
1. **linkFilter post-pagination**: DB returns paginated results, then JS filters linked/unlinked. pagination.total is pre-filter count. Page sizes are inconsistent.
2. **No auth**: All link endpoints use service role key with no auth check. Public API.
3. **ilike wildcard injection**: User input with % or _ chars interpreted as SQL wildcards.
4. **buildLinkBody duplicated**: In RightPanel.tsx (lines 228-234) and useBulkLinking.ts (lines 113-124).
5. **RightPanel overlay broken**: absolute inset-0 without position:relative on parent container.
6. **updateItemLink is UI-only**: No refetch after bulk operations complete.

## Design Issues
- 3 pages are 99% identical (only `const config = SOURCE_CONFIGS.xxx` differs)
- 6 API routes are ~80% identical (differ in table name, key column, meta shaping)
- shop_id queried by name string every request (fragile, N+1 per request)
- sale_sites queried with limit(100) + JS find instead of eq filter
- stats.linked/unlinked calculated from current page, not DB total
- checkedItems Set persists across page navigation
- Double API call on search (immediate + debounced)
- useCardSearch cache grows unbounded
- Module-scope Supabase client in all API routes

## JustTCG Explorer Comparison
- JustTCG: 1 page, game switching via state. Linking: 3 physical pages (copy-paste)
- JustTCG: aria-label on buttons. Linking: mostly missing
- JustTCG: error state banner. Linking: alert() in RightPanel
- JustTCG: LeftPanel props passed as spread object. Linking: inline props (inconsistent across 3 pages)
- Both share: scroll lock pattern, ESC key handler, mobile drawer/bottom sheet pattern

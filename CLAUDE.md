# CLAUDE.md

すべて日本語で応答してください。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**toreca-app** is a Japanese trading card marketplace application for tracking card prices, scraping marketplace data, and managing inventory. It is one of two repositories:

- **toreca-app** (this repo) — Next.js web app + API routes, deployed on Vercel
- **toreca-scraper** — Express.js scraping service, deployed on Railway

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm run start        # Start production server
```

No test runner is configured. Playwright is installed for browser automation (scraping), not testing.

## Architecture

### Stack

- **Next.js 16** (App Router) with React 19, TypeScript (strict: false)
- **Supabase** (PostgreSQL) for database and auth
- **Tailwind CSS 4** for styling
- **Vercel** for hosting and cron jobs
- Path alias: `@/*` maps to project root

### Key Directories

- `app/` — Next.js App Router pages and 50+ API routes
- `app/api/cron/` — 8 Vercel cron jobs (see vercel.json for schedules)
- `components/` — React components; `components/pages/` for full page views
- `lib/` — Shared utilities, types, and service clients
- `lib/api/` — Client-side API helper functions (barrel export from `lib/api/index.ts`)
- `lib/scraping/helpers.ts` — Shared scraping parsers (time, grade, price)
- `lib/ai/gemini.ts` — Gemini AI client
- `lib/config.ts` — Centralized environment variable access
- `lib/types.ts` — Core TypeScript interfaces (300+ lines)
- `.agent/docs/ARCHITECTURE.md` — Detailed system architecture (Japanese)

### Data Flow

The app has two scraping patterns:
1. **Purchase history** (Snkrdunk only) — via `/api/snkrdunk-scrape` (manual) and `/api/cron/snkrdunk-auto-scrape` (auto). Both delegate to the Railway scraper.
2. **Sale prices/inventory** (CardRush, TorecaCamp, Drasuta, Snkrdunk) — via `/api/cron/update-prices`, also delegated to the Railway scraper.

Static sites use direct fetch with ZenRows proxy fallback. Dynamic sites (Snkrdunk) require ZenRows browser.

### External Services

- **Supabase** — Database, auth
- **Google Gemini / Google Cloud Vision** — AI card recognition, OCR
- **ZenRows** — Browser proxy (via Railway scraper)
- **Snkrdunk, CardRush, TorecaCamp, Drasuta** — Marketplace data sources
- **X (Twitter) API** — Tweet monitoring for price data
- **Shinsoku, TorecaLounge** — Card pricing/marketplace services

### Cron Jobs (vercel.json)

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/update-prices` | Every 20 min | Sale price updates |
| `/api/cron/snkrdunk-auto-scrape` | Every 20 min | Snkrdunk purchase history |
| `/api/cron/daily-price-aggregate` | 22:00 UTC daily | Daily price aggregation |
| `/api/cron/shinsoku-sync` | 2:00, 4:00, 13:00 UTC | Shinsoku data sync |
| `/api/cron/shinsoku` | 2:30, 4:30, 13:30 UTC | Shinsoku price fetch |
| `/api/cron/lounge-cache` | 2:00, 4:00, 13:00 UTC | TorecaLounge cache |
| `/api/cron/toreca-lounge` | 2:30, 4:30, 13:30 UTC | TorecaLounge price fetch |
| `/api/twitter/monitor` | Hourly | Twitter/X monitoring |

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin operations
- `CRON_SECRET` — Bearer token for cron job authentication
- `GEMINI_API_KEY` — Google Gemini AI
- `GOOGLE_APPLICATION_CREDENTIALS` — Google Cloud Vision (JSON string)
- `TORECA_SCRAPER_URL` — Railway scraper URL
- `X_BEARER_TOKEN` — Twitter/X API

### UI Patterns

- Single-page app shell in `components/TorekaApp.tsx` with page navigation via localStorage key `toreca-currentPage`
- All interactive components use `'use client'` directive
- Page components in `components/pages/` are loaded by TorekaApp based on current page state
- POS system has its own route tree under `app/pos/` and components under `components/pos/`
- Charts use Recharts library

### Database

Supabase client is initialized in `lib/supabase.ts`. Key tables: `cards`, `purchase_prices`, `sale_prices`, `card_sale_urls`, `pending_images`, `pending_cards`, `purchase_shops`, `sale_sites`, and a 4-level category hierarchy (`category_large` → `category_medium` → `category_small` → `category_detail`) plus `rarities`.

## Conventions

- The app and all documentation are primarily in Japanese
- API routes use `NextResponse.json()` for responses
- Cron endpoints verify `Authorization: Bearer ${CRON_SECRET}` header
- Scraping helpers in `lib/scraping/helpers.ts` are shared between manual and auto-scrape routes — keep them in sync
- Client-side API functions live in `lib/api/` and are imported via barrel export

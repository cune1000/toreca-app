# CLAUDE.md

すべて日本語で応答してください。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**toreca-app** is a Japanese trading card marketplace application for tracking card prices, scraping marketplace data, and managing inventory. It is one of two repositories:

- **toreca-app** (this repo) — Next.js web app + API routes, deployed on Vercel

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

- **Snkrdunk sale prices** — via `/api/cron/snkrdunk-sync` (auto batch) and `/api/snkrdunk-scrape` (manual)
- **Purchase prices** — Shinsoku/TorecaLounge via dedicated cron jobs
- **Overseas prices** — PriceCharting via `/api/cron/overseas-price-sync`

### External Services

- **Supabase** — Database, auth
- **Google Gemini / Google Cloud Vision** — AI card recognition, OCR
- **Snkrdunk** — Marketplace data source (API direct)
- **X (Twitter) API** — Tweet monitoring for price data
- **Shinsoku, TorecaLounge** — Card pricing/marketplace services
- **PriceCharting** — Overseas card prices (USD)

### Cron Jobs (vercel.json)

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/snkrdunk-sync` | Every 5 min | Snkrdunk sale data batch sync |
| `/api/cron/daily-price-aggregate` | Hourly | Daily price aggregation |
| `/api/cron/shinsoku-sync` | Hourly | Shinsoku data sync |
| `/api/cron/shinsoku` | Hourly | Shinsoku price fetch |
| `/api/cron/lounge-cache` | Hourly | TorecaLounge cache |
| `/api/cron/toreca-lounge` | Hourly | TorecaLounge price fetch |
| `/api/cron/exchange-rate-sync` | Hourly | USD→JPY exchange rate |
| `/api/cron/overseas-price-sync` | Hourly | PriceCharting overseas prices |
| `/api/twitter/monitor` | Every 5 min | Twitter/X monitoring |

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin operations
- `CRON_SECRET` — Bearer token for cron job authentication
- `GEMINI_API_KEY` — Google Gemini AI
- `GOOGLE_APPLICATION_CREDENTIALS` — Google Cloud Vision (JSON string)
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

# Cryptoprice

[![CI](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml/badge.svg)](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-3c873a)

A full-stack **React + Vercel** market dashboard for live crypto and global-asset monitoring. It provides real-time pricing for the top 10 cryptocurrencies, top 10 stocks, top 10 global assets, and a dedicated panel for the Midnight Token (`NIGHT`) — all from a single API call with resilient multi-tier fallback behavior.

---

## Table of Contents

- [Preview](#preview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Suggested Improvements](#suggested-improvements)
- [Contributing and Policies](#contributing-and-policies)
- [License](#license)

---

## Preview

| Default view | Card hover |
|---|---|
| ![Cryptoprice dashboard](./site-preview.png) | ![Hover state](./final-preview-hover.png) |

---

## Features

- **Single unified payload** — one client request to `GET /api/dashboard` returns everything.
- **Multi-tier reliability** — in-memory TTL cache → stale-if-error fallback → local JSON fallback → optional durable KV cache.
- **Complete card design system** — every asset renders a ticker pill and logo with monogram fallback.
- **Rich UX controls** — search, category filter, sort modes, watchlist pinning, and side-by-side compare mode (up to 3 cryptos).
- **7-day sparklines** — compact inline price-change charts on crypto cards.
- **Accessible UI** — keyboard-navigable interactive cards, visible focus states, `aria-live` status updates, and `prefers-reduced-motion` support.
- **Operational metrics** — per-provider latency/success/fallback counters exposed via `GET /api/health`.

---

## Architecture

```text
Frontend (Vite + React + React Query)
  └─> GET /api/dashboard
        └─> Server aggregation layer
              ├─> FinancialModelingPrep  (top 10 stocks / equities)
              ├─> CoinPaprika            (top 10 cryptos + NIGHT token)
              ├─> In-memory TTL cache    (default: 60 s fresh window)
              ├─> Stale-if-error window  (default: 600 s)
              ├─> Local JSON fallback    (server/fallback/dashboard-fallback.json)
              └─> Optional durable cache (Upstash / Vercel KV REST)
```

---

## Quick Start

**Prerequisites**

- Node.js `20.x` or newer
- npm `10.x` or newer
- A free [FinancialModelingPrep API key](https://financialmodelingprep.com/developer) (`FMP_API_KEY`)

**Install and run**

```bash
npm install
cp .env.example .env
# Edit .env and add your FMP_API_KEY
npm run dev
```

The development server starts at **http://localhost:5188** with a local API plugin that proxies serverless routes.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `FMP_API_KEY` | **Yes** | `demo` | FinancialModelingPrep API key |
| `FMP_BASE_URL` | No | `https://financialmodelingprep.com/api/v3` | FMP base URL override |
| `COINPAPRIKA_BASE_URL` | No | `https://api.coinpaprika.com` | CoinPaprika base URL override |
| `CACHE_TTL_SEC` | No | `60` | In-memory cache fresh window (15–300 s) |
| `FALLBACK_TTL_SEC` | No | `600` | Stale-if-error window (60–3600 s) |
| `KV_REST_API_URL` | No | — | Upstash/Vercel KV REST endpoint (durable cache) |
| `KV_REST_API_TOKEN` | No | — | Upstash/Vercel KV REST token |
| `DURABLE_CACHE_KEY` | No | `cryptoprice:dashboard:payload` | Redis key for durable cache |

---

## API Reference

### `GET /api/dashboard`

Returns the normalized dashboard payload. Sets `X-Cryptoprice-Stale` and `X-Cryptoprice-Fallback` response headers.

**Response shape**

```json
{
  "generatedAt": "2026-02-23T00:00:00.000Z",
  "stale": false,
  "refreshInSec": 60,
  "source": {
    "equities": "fmp",
    "crypto": "coinpaprika",
    "fallbackUsed": false
  },
  "topCryptos": [],
  "topStocks": [],
  "topAssets": [],
  "night": null
}
```

### `GET /api/health`

Returns service status, durable cache configuration state, and per-provider runtime metrics.

### `GET /api/logo?url=<https-logo-url>`

Proxies remote asset logos with URL validation and long-lived cache headers. Used in production to avoid mixed-content and CORS issues.

### `POST /api/client-error`

Accepts client-side error events (message, source, stack) for operational visibility.

---

## Reliability Model

| Stage | Condition | Behavior |
|---|---|---|
| Fresh cache | Age ≤ `CACHE_TTL_SEC` | Serve cached segment immediately |
| Live fetch | Cache expired | Call provider, cache result |
| Stale cache | Provider failure, age ≤ `FALLBACK_TTL_SEC` | Serve stale data, mark `stale: true` |
| Local fallback | No cache available | Serve bundled JSON, mark `fallbackUsed: true` |
| Durable cache | Optional KV configured | Read/write payload across cold starts |

All provider numbers are sanitized before response output to prevent `NaN` or `Infinity` from reaching the client.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Local dev server with API plugin |
| `npm run lint` | ESLint checks |
| `npm run lint:fix` | Auto-fix lintable issues |
| `npm run typecheck` | TypeScript checks (app + node + server) |
| `npm run test` | Vitest unit/integration suite |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run build` | Typecheck + production Vite build |
| `npm run preview` | Serve production build locally |
| `npm run check` | CI-style validation alias (`build`) |

---

## Testing

Run the full local quality gate (mirrors CI):

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

**Coverage areas**

- Formatter correctness and invalid number handling (`src/lib/formatters.test.ts`)
- CoinPaprika and FMP provider normalization (`server/providers/*.test.ts`)
- Dashboard assembly, cache TTL, stale fallback, and JSON fallback (`server/dashboard.test.ts`)
- UI smoke flow — sections, logos, ticker pills, hoverable cards, status indicator (`src/App.test.tsx`, `tests/e2e/`)
- LogoMark fallback chain and monogram rendering (`src/components/LogoMark.test.tsx`)

---

## Project Structure

```text
api/             # Vercel serverless route handlers
server/          # Provider adapters, aggregation, cache, metrics, sanitization
  providers/     # CoinPaprika and FMP adapters
  fallback/      # Bundled JSON fallback payload
src/             # React application
  components/    # MarketCard, SectionHeader, LogoMark, ErrorBoundary
  lib/           # Formatters, monogram utility
  types/         # Shared TypeScript types
tests/
  e2e/           # Playwright smoke tests
```

---

## Deployment

This project is designed for **Vercel** full-stack deployment.

1. Import the repository into Vercel.
2. Set the required environment variables (`FMP_API_KEY` at minimum).
3. Deploy — Vercel detects the `vite` framework and `nodejs20.x` API runtime from `vercel.json`.

**Recommended production env vars**

```text
FMP_API_KEY=<your-key>
COINPAPRIKA_BASE_URL=https://api.coinpaprika.com
CACHE_TTL_SEC=60
FALLBACK_TTL_SEC=600
```

Optionally add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to enable the durable cache (resilient across cold starts and provider outages).

---

## Suggested Improvements

The following are areas identified during code review that could improve the project further:

- **FMP stock screener sorting** — The FMP `/stock-screener` endpoint is called with a fixed `limit`. Adding `sortBy=marketCap&order=desc` query parameters (if supported by the FMP tier in use) would guarantee that the top companies by market cap are returned before local trimming, rather than relying on the API's default order.
- **Request a larger FMP pool** — Fetching `limit=50` from FMP and then slicing to the top 10 after local market-cap sorting would make the "Top 10 Stocks" list more accurate, at the cost of a slightly larger API response.
- **Sparkline data quality** — The 7-day sparkline is currently approximated from CoinPaprika percentage-change fields (15m, 1h, 6h, 24h, 7d) rather than actual historical OHLC data. Using a dedicated historical prices endpoint would produce a more accurate chart.
- **Shared type package** — `src/types/dashboard.ts` and `server/types.ts` are intentionally kept separate (different TypeScript projects/runtimes), but a shared package or code-generation step could ensure the two definitions stay in sync automatically.
- **Rate-limit / retry budget** — The retry logic in `server/request.ts` uses a fixed 180 ms back-off. Exponential back-off with jitter would be more robust under sustained provider pressure.
- **E2E coverage** — The Playwright suite currently runs a single smoke flow. Adding explicit tests for search/filter, compare mode, and watchlist persistence would improve confidence.

---

## Contributing and Policies

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [CHANGELOG.md](./CHANGELOG.md)

---

## License

MIT. See [LICENSE](./LICENSE).


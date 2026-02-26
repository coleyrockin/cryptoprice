# World Asset Prices

[![CI](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml/badge.svg)](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-3c873a)

**Live Site:** [https://coleyrockin.github.io/cryptoprice/](https://coleyrockin.github.io/cryptoprice/)

World Asset Prices is a full-stack React + Vercel dashboard that tracks the **top 10 cryptos**, **top 10 stocks**, and **top 10 global assets** by market cap — with resilient fallback behavior, ticker pills, logo support, and a dedicated Midnight Token (`NIGHT`) panel.

## Preview

![World Asset Prices dashboard preview](./site-preview.png)

## Why This Project

- Single dashboard payload: one client query to `GET /api/dashboard`.
- Reliability first: provider cache, stale-if-error fallback, and optional durable cache.
- Complete card design system: all assets render a ticker pill and logo or monogram fallback.
- Powerful UX controls: search, category filter, sort modes, watchlist pinning, and compare mode.
- Production quality gates: lint, typecheck, unit/integration tests, smoke E2E, and build verification.

## Architecture

```text
Frontend (Vite + React + React Query)
  -> /api/dashboard
     -> Server aggregation layer
        -> FinancialModelingPrep (stocks/equities)
        -> CoinPaprika (top cryptos + NIGHT)
        -> In-memory TTL cache (30s default)
        -> Stale-if-error fallback window (600s default)
        -> Local last-known-good JSON fallback
        -> Optional durable cache (Upstash/Vercel KV REST)
```

## API Endpoints

- `GET /api/dashboard`
  - Returns normalized dashboard payload for cryptos, stocks, assets, and NIGHT.
  - Adds `degradedSegments`, `segmentMeta`, and `requestId` for operational clarity.
  - Sets `X-Wap-Stale`, `X-Wap-Fallback`, and `X-Wap-Request-Id` headers.
- `GET /api/health`
  - Returns readiness (`ready`/`degraded`/`down`), checks, provider status, and runtime metrics.
- `GET /api/logo?url=<https-logo-url>`
  - Proxies remote logos with strict host allowlist, payload-size limits, and rate limiting.
- `POST /api/client-error`
  - Accepts schema-validated client-side error events with body-size guard and rate limiting.

### Dashboard Response Shape

```json
{
  "generatedAt": "2026-02-23T00:00:00.000Z",
  "stale": false,
  "refreshInSec": 30,
  "source": {
    "equities": "fmp",
    "crypto": "coinpaprika",
    "fallbackUsed": false
  },
  "degradedSegments": [],
  "segmentMeta": {
    "topCryptos": { "source": "live", "ageSec": 0 },
    "topStocks": { "source": "live", "ageSec": 0 },
    "night": { "source": "live", "ageSec": 0 }
  },
  "requestId": "f83a90f9-7b34-4cae-b6f6-0fbcb84f8bb3",
  "topCryptos": [],
  "topStocks": [],
  "topAssets": [],
  "night": null
}
```

## Reliability Model

- Fresh window (`CACHE_TTL_SEC`, default `30`):
  - Serve in-memory cached segment.
- Provider failure path:
  - Attempt stale in-memory cache (`FALLBACK_TTL_SEC`, default `600`).
  - If unavailable, serve validated local fallback payload.
- Durable fallback (optional):
  - Read and write dashboard payload from KV REST cache.
  - Used to recover from broad provider/network outages.
- Numeric safety:
  - All provider numbers are normalized before response output to avoid `NaN` and `Infinity`.

## UI/UX Features

- Black + glass visual system with motion-based card entrance and hover shine.
- Gradient glass hover treatment for cards (blue/green/pink family).
- Ticker pill and logo/fallback mark across crypto, stock, and asset cards.
- Keyboard-accessible interactive cards with visible focus states.
- `prefers-reduced-motion` fallback for motion-sensitive users.

## Quick Start

Prerequisites:

- Node.js `20.x` or newer
- npm `10.x` or newer

Install and run:

```bash
npm install
cp .env.example .env
npm run dev
```

Local URL: `http://localhost:5188`

## Environment Variables

From `.env.example`:

- `FMP_API_KEY`
- `FMP_BASE_URL`
- `COINPAPRIKA_BASE_URL`
- `CACHE_TTL_SEC`
- `FALLBACK_TTL_SEC`
- `KV_REST_API_URL` (optional)
- `KV_REST_API_TOKEN` (optional)
- `DURABLE_CACHE_KEY` (optional)
- `STALE_ALERT_SEC`
- `LOGO_ALLOWED_HOSTS`
- `LOGO_PROXY_TIMEOUT_MS`
- `LOGO_PROXY_MAX_BYTES`
- `LOGO_PROXY_RATE_LIMIT_PER_MIN`
- `CLIENT_ERROR_MAX_BYTES`
- `CLIENT_ERROR_RATE_LIMIT_PER_MIN`

## Scripts

- `npm run dev` - local development server + local API plugin.
- `npm run lint` - ESLint checks.
- `npm run lint:fix` - autofix lintable issues.
- `npm run typecheck` - TypeScript checks for app, node, and server projects.
- `npm run test` - Vitest unit/integration suite.
- `npm run test:routes` - API route test suite.
- `npm run test:e2e` - Playwright smoke test.
- `npm run build` - typecheck + production build.
- `npm run check:bundle` - fail if main bundle exceeds configured size budget.
- `npm run preview` - serve production build locally.
- `npm run check` - local full-gate validation (lint, typecheck, tests, routes, build, bundle budget).

## Testing and Quality Gates

Local parity with CI:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:routes
npm run build
npm run check:bundle
npm run test:e2e
```

Coverage focus:

- Formatter correctness and invalid number handling.
- Provider normalization and schema mapping.
- Fallback/cache behavior in dashboard assembly.
- UI smoke flow (sections, logos/fallback marks, ticker pills, hoverable cards, status updates).

## Project Structure

```text
api/        # Vercel serverless routes
server/     # provider adapters, aggregation, cache, metrics, sanitization
src/        # React app, components, styles, client API wrappers
tests/e2e/  # Playwright smoke tests
```

## Deployment

- Target: Vercel full-stack deployment.
- Config: `vercel.json` (`framework: "vite"`, output `dist`, API runtime `nodejs20.x`).
- Recommended runtime envs:
  - `FMP_API_KEY`
  - `COINPAPRIKA_BASE_URL`
  - `CACHE_TTL_SEC`
  - `FALLBACK_TTL_SEC`
  - Optional KV REST vars for durable cache.

## Contributing and Policies

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [CHANGELOG.md](./CHANGELOG.md)

## License

MIT. See [LICENSE](./LICENSE).

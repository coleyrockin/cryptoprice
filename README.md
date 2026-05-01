# World Asset Prices

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat&logo=reactquery&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=flat&logo=framer&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?style=flat&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat&logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

**Live Site:** [world-asset-prices.vercel.app](https://world-asset-prices.vercel.app)

---

<p align="center">
  <img src="docs/preview-full.png" alt="World Asset Prices dashboard — animated gradient hero, six live sections, midnight aurora spotlight" width="720">
</p>

---

## About

A live financial dashboard tracking the **top 10 stocks, ETFs, fiat currencies, and cryptocurrencies** side-by-side in one view, plus a dedicated Midnight Token (NIGHT) panel. Built as a full-stack React + Vercel app with a resilient serverless data layer.

A single `GET /api/dashboard` call powers the entire payload — the frontend never talks to external APIs directly. The server composes data from multiple free, no-key providers (Stooq, Frankfurter, CoinPaprika) behind a tiered cache: fresh in-memory → stale-if-error → durable KV fallback → bundled fallback JSON. The site never shows "no data," even if every upstream goes down.

**Zero API keys required to run it locally or deploy it.**

## Features

- **Six live sections** — Global Assets, Stocks, ETFs, Currencies, Cryptos, and the Midnight Token panel
- **Market discovery controls** — search by name, symbol, or category; filter by section; sort every grid by rank, name, value, or absolute movement
- **Pinned watchlist** — pin any market card into a persistent watchlist for faster cross-section monitoring
- **Hero insight rail** — instant snapshot of tracked market count, data health, largest move, and global leader
- **Per-section freshness badge** — each section surfaces its real data source in real time: green "Live · Xs ago" (pulsing dot), amber "Stale cache" / "Durable cache", or red "Fallback". The ticker updates every second so you can watch freshness drift between refreshes
- **Price update pulse** — card values flash a soft green highlight for 600ms whenever a new value arrives, so live refreshes are visually confirmed (suppressed under `prefers-reduced-motion`)
- **Animated hero gradient** — the title flows continuously through a five-stop spectrum on a 14s loop (cyan → violet → magenta → amber → cyan), respects `prefers-reduced-motion`
- **Midnight aurora spotlight** — the NIGHT panel renders as a starlit aurora with twinkling pinpoints, dual indigo/violet halo glows, and a top aurora ribbon
- **Sparkline glow** — every 7-day sparkline carries a soft drop-shadow that intensifies (green → cyan blend) on card hover
- **Hardened logo proxy** — strict hostname allowlist with private-IP blocking, explicit content-type allowlist (no SVG re-serving), per-IP rate limiting keyed on Vercel's unspoofable `x-real-ip`
- **Light / dark mode** — instant toggle, respects `prefers-color-scheme` on first load, persists preference
- **Intraday change %** — color-coded green/red on every card (calculated from open → latest close)
- **7-day sparklines** — inline SVG trend charts on crypto cards
- **Auto-refresh** — refetches every 30 seconds via TanStack Query
- **Resilient fetch layer** — live provider → fresh cache → stale cache → durable KV → bundled fallback, with the chosen tier exposed per segment in the UI
- **Production CI gates** — lint, typecheck, unit tests, route tests, E2E smoke tests, and bundle-size check

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, TanStack React Query 5 |
| **Styling** | Tailwind CSS v4, clsx |
| **Animation** | Framer Motion 12 |
| **Backend** | Vercel Serverless Functions (Node 24) |
| **Data sources** | [Stooq](https://stooq.com) (stocks + ETFs), [Frankfurter / ECB](https://frankfurter.dev) (FX), [CoinPaprika](https://coinpaprika.com/api/) (crypto) — all free, no keys |
| **Durable cache** | Upstash / Vercel KV (optional; falls back to in-memory + bundled JSON) |
| **Testing** | Vitest 4, Testing Library, Playwright E2E |
| **Linting** | ESLint 10, typescript-eslint |
| **Deployment** | Vercel |

## Getting Started

```bash
# Clone
git clone https://github.com/coleyrockin/world-asset-prices.git
cd world-asset-prices

# Install dependencies
npm install

# Start the dev server — no env vars required
npm run dev
```

The app runs at `http://localhost:5188`.

## Environment Variables

All environment variables are **optional** — the app runs fully without any configuration. Copy `.env.example` to `.env` if you want to tune caching, enable a durable KV cache, or adjust rate limits.

| Variable | Description | Default |
|----------|-------------|---------|
| `COINPAPRIKA_BASE_URL` | Override CoinPaprika base URL | `https://api.coinpaprika.com` |
| `CACHE_TTL_SEC` | Live-data cache TTL (seconds) | `30` |
| `FALLBACK_TTL_SEC` | Stale cache TTL before bundled fallback | `600` |
| `STALE_ALERT_SEC` | Threshold for flagging stale-served responses | `300` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash / Vercel KV REST credentials for durable cache | unset (falls back to in-memory) |
| `LOGO_PROXY_*` | Logo proxy host allowlist, rate limits, and size caps | see `.env.example` |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5188 (also runs the serverless handlers locally) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit / integration tests |
| `npm run test:routes` | Run serverless route tests |
| `npm run test:e2e` | Run Playwright E2E smoke tests |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type checking across all three project configs |
| `npm run check` | Full CI pipeline (lint + typecheck + tests + build + bundle check) |

## Project Structure

```
world-asset-prices/
├── .github/           # CI workflows and issue templates
├── api/               # Vercel serverless endpoints
│   ├── dashboard.ts   # Main data endpoint — GET /api/dashboard
│   ├── logo.ts        # Logo proxy — GET /api/logo?url=...
│   ├── health.ts      # Health check — GET /api/health
│   └── client-error.ts # Client-side error reporting — POST /api/client-error
├── server/            # Server-side logic (shared by api/ and dev server)
│   ├── providers/     # Stooq, Frankfurter, and CoinPaprika data providers
│   ├── cache.ts       # In-memory TTL cache
│   ├── durable-cache.ts # Upstash / Vercel KV integration
│   ├── fallback/      # Bundled last-resort payload JSON
│   ├── dashboard.ts   # Dashboard payload assembly + segment resolution
│   ├── metrics.ts     # Provider success/failure counters
│   ├── log.ts         # Structured logger + request ID
│   ├── security.ts    # Request validation and sanitization
│   ├── rate-limit.ts  # In-memory rate limiter
│   └── env.ts         # Typed env var helpers
├── src/               # React frontend
│   ├── components/    # MarketCard, SectionHeader, LogoMark, etc.
│   ├── hooks/         # useTheme, useTilt
│   ├── lib/           # formatters, monogram utilities
│   ├── types/         # Shared TypeScript types
│   ├── App.tsx        # Main app component
│   └── globals.css    # Tailwind v4 entry + theme variables
├── tests/e2e/         # Playwright smoke tests
├── index.html         # Entry HTML
├── vite.config.ts     # Vite configuration (includes local API dev plugin)
├── vercel.json        # Vercel deployment config
└── package.json
```

## What this demonstrates

- **Production-grade fetch resilience.** Every upstream is wrapped in a segment resolver that tries live → fresh cache → stale cache → durable KV → bundled fallback. The dashboard degrades gracefully and never renders empty state.
- **Provider-agnostic data pipeline.** Providers implement a narrow contract (`fetch*From*()` returns a typed array) and are swappable without touching the UI — swapping FMP → Stooq + Frankfurter was a two-file change.
- **Data-center-aware networking.** Stooq fetching uses a bounded concurrency pool (4 at a time) because Vercel's AWS IPs hit aggressive rate limits on naïve fan-out. Frankfurter's business-day date logic handles ECB's weekend publishing gaps so change% is always a true 1-business-day delta.
- **Full TS strict mode across three project configs** (client, node, server) with clean typecheck.
- **CI gates that actually catch regressions**: lint, typecheck, unit, route, E2E, and a bundle-size budget.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and run `npm run check` to verify everything passes
4. Commit with a descriptive message: `git commit -m "feat: add your feature"`
5. Open a pull request against `main`

Please open an issue first for significant changes.

## License

MIT © Boyd Roberts

# Cryptoprice

Cryptoprice is a dark-theme market dashboard focused on:

- Top 10 global coins by market cap
- A dedicated Midnight Token (`NIGHT`) telemetry view

## Features

- Live top-10 coin grid with auto-refresh
- Spotlight mode that cycles through ranked coins
- Volatility skyline chart (24h change)
- Dedicated NIGHT panel:
  - Spot price
  - 24h / short-horizon momentum
  - Market cap and volume
  - OHLC range gauge

## Tech Stack

- React + TypeScript + Vite
- `@tanstack/react-query` for polling/cache state
- `framer-motion` for transitions/animation
- `recharts` for chart rendering
- `clsx` for conditional class logic

## Quick Start

```bash
npm install
npm run dev
```

App runs at: `http://localhost:5188`

## Scripts

- `npm run dev` starts the local dev server on `5188`
- `npm run build` runs type-check/build for production
- `npm run preview` serves the production build on `5189`

## Data Sources

- Top 10: `https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=10`
- NIGHT quote: `https://api.coinpaprika.com/v1/tickers/night-midnight2?quotes=USD`
- NIGHT latest OHLC: `https://api.coinpaprika.com/v1/coins/night-midnight2/ohlcv/latest?quote=usd`

## Project Structure

```text
src/
  api.ts         API fetch + types
  App.tsx        Main dashboard layout and views
  main.tsx       App bootstrap + React Query provider
  styles.css     Global styling/theme
```

## Troubleshooting

- If you see another project, make sure you are opening `http://localhost:5188` (not `5173`).
- If data panels are empty, check browser network access to `api.coinpaprika.com`.

## GitHub

- Repository: `https://github.com/coleyrockin/cryptoprice`
- Issues: `https://github.com/coleyrockin/cryptoprice/issues`

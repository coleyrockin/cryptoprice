# Cryptoprice

[![CI](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml/badge.svg)](https://github.com/coleyrockin/cryptoprice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-3c873a)

Cryptoprice is a React dashboard for live cryptocurrency market monitoring, with a dedicated telemetry panel for Midnight Token (`NIGHT`).

## Preview

![Cryptoprice dashboard preview](./site-preview.png)

## Highlights

- Top 10 market-cap coins with live polling.
- Spotlight mode that cycles through ranked assets.
- 24h volatility skyline chart for quick momentum scanning.
- Dedicated `NIGHT` detail panel with spot price, market cap, volume, momentum, and latest OHLC range visualization.

## Stack

- React 19 + TypeScript
- Vite 7
- `@tanstack/react-query`
- `framer-motion`
- `recharts`

## Getting Started

Prerequisites:

- Node.js `20.x` or newer
- npm `10.x` or newer

Install and run locally:

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5188`

## Scripts

- `npm run dev`: run local development server.
- `npm run typecheck`: run TypeScript project checks.
- `npm run build`: run typecheck and produce production build.
- `npm run check`: CI-style validation command.
- `npm run preview`: serve built app locally.

## Data Sources

- `https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=10`
- `https://api.coinpaprika.com/v1/tickers/night-midnight2?quotes=USD`
- `https://api.coinpaprika.com/v1/coins/night-midnight2/ohlcv/latest?quote=usd`

## Project Structure

```text
src/
  api.ts
  App.tsx
  main.tsx
  styles.css
```

## Contributing and Security

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Repository Standards

- CI workflow for pull requests and `main` pushes.
- Dependabot updates for npm and GitHub Actions.
- Structured issue templates and pull request template.
- Consistent formatting through `.editorconfig` and `.gitattributes`.

## Suggested Upgrades

- Add ESLint + Prettier checks in CI to keep style and common bug patterns consistent.
- Add a lightweight test layer (for example Vitest + React Testing Library) to cover formatting helpers and API adapter behavior.
- Move API endpoints in `src/api.ts` to environment variables (`VITE_*`) to simplify provider changes across environments.
- Add a React error boundary around the dashboard shell to provide graceful fallback UI for rendering failures.
- Add route/component-level code splitting to reduce the current large bundle warning in production builds.

## License

MIT, see [LICENSE](./LICENSE).

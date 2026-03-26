# World Asset Prices

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat&logo=reactquery&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=flat&logo=framer&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?style=flat&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat&logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

**Live Site:** [coleyrockin.github.io/cryptoprice](https://coleyrockin.github.io/cryptoprice/)

---

## About

World Asset Prices is a full-stack React + Vercel dashboard that tracks the top 10 cryptos, top 10 stocks, and top 10 global assets by market cap. Built with resilient fallback behavior, ticker pills, logo support, and a dedicated Midnight Token (NIGHT) panel. A single client query to `GET /api/dashboard` powers the entire payload.

## Features

- **Three asset categories** — crypto, stocks, and global assets ranked by market cap
- **Midnight Token panel** — dedicated NIGHT token price display
- **Resilient data layer** — provider cache, stale-if-error fallback, and optional durable cache
- **Complete card design** — ticker pills with logo or monogram fallback for every asset
- **Powerful UX controls** — search, category filter, sort modes, watchlist pinning, and compare mode
- **Production quality gates** — lint, typecheck, unit/integration tests, smoke E2E, and build verification
- **Framer Motion animations** — smooth transitions and micro-interactions throughout

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, TanStack React Query 5 |
| **Animation** | Framer Motion 12 |
| **Styling** | CSS Modules, clsx |
| **Backend** | Vercel Serverless Functions |
| **Testing** | Vitest 4, Testing Library, Playwright E2E |
| **Linting** | ESLint 10, typescript-eslint |
| **Deployment** | GitHub Pages, Vercel |

## Getting Started

```bash
# Clone the repository
git clone https://github.com/coleyrockin/cryptoprice.git

# Navigate to the project
cd cryptoprice

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run test` | Run unit/integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run check` | Full CI pipeline (lint + typecheck + test + build) |
| `npm run preview` | Preview production build |

## Project Structure

```
cryptoprice/
├── .github/           # CI workflows
├── api/               # Vercel serverless endpoints
├── docs/              # Documentation
├── scripts/           # Build and bundle scripts
├── server/            # Server-side logic and caching
├── src/               # React frontend source
├── tests/             # Test suites
├── index.html         # Entry HTML
├── vite.config.ts     # Vite configuration
├── vitest.config.ts   # Vitest configuration
├── playwright.config.ts # E2E test configuration
├── vercel.json        # Vercel deployment config
└── package.json       # Dependencies and scripts
```

---

*Built with React, TypeScript, and Vite.*

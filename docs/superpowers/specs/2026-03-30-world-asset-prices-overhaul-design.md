# World Asset Prices — Overhaul Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Overview

Full overhaul of the `cryptoprice` GitHub repo to make it showcase-ready. The app is already feature-rich (search, filter, sort, watchlist, sparklines, 24h change, auto-refresh, error handling, unit tests). The actual gaps are: Tailwind CSS migration, light/dark mode toggle, explicit "last updated" timestamp, and README polish under the correct "World Asset Prices" branding.

---

## Phase 1 — Audit (Reference)

### Stack (confirmed)
- React 19 + TypeScript 5.9 + Vite 7
- TanStack React Query 5 (data fetching + auto-refresh)
- Framer Motion 12 (animations)
- Vercel Serverless Functions (`api/`)
- Plain CSS (`src/styles.css`, ~600 lines) — **being replaced**
- Vitest 4 + Testing Library + Playwright

### Already working (no changes needed)
- Search/filter by name + symbol
- Category filter (all / crypto / stock / commodity)
- Sort modes (rank, market cap, 24h change, name)
- 24h price change % with green/red color coding
- Sparkline 7d mini chart on crypto cards
- Auto-refresh via TanStack Query refetchInterval
- Watchlist/favorites with localStorage + migration path
- Compare mode (up to 3 cryptos)
- Error handling (stale fallback, degraded segments, error boundary)
- Skeleton loading states
- `.env.example`, `.gitignore`, unit tests

### Confirmed gaps
1. No light/dark mode toggle
2. No explicit "last updated at HH:MM:SS" display (has countdown only)
3. `package.json` `name` field is `world-asset-prices` but description/author inconsistent
4. README needs screenshot placeholder, live demo link placeholder, contributing section

---

## Phase 2 — Tailwind Migration

### Approach: Tailwind v4 CSS-first

Install `tailwindcss@next` (v4). Tailwind v4 uses a CSS `@import "tailwindcss"` entry point with no `tailwind.config.js` required. Dark mode configured via `@variant dark (&:where(.dark, .dark *))` or the v4 `darkMode` option.

**`src/globals.css`** replaces `src/styles.css`:
```
@import "tailwindcss";

@theme {
  --font-sans: 'Space Grotesk', sans-serif;
  --font-display: 'Sora', sans-serif;
  /* color tokens for both themes */
}

@layer base {
  /* Google Fonts import */
  /* background orb animations (too complex for utilities) */
  /* sparkline SVG styles */
  /* theme-aware color vars */
}
```

All component `className` strings rewritten with Tailwind utility classes. `clsx` stays for conditional classes.

### Files changed
- `src/styles.css` → deleted
- `src/globals.css` → new entry
- `src/main.tsx` → import `globals.css` instead
- `src/App.tsx` → Tailwind classes throughout
- `src/components/MarketCard.tsx` → Tailwind classes
- `src/components/SectionHeader.tsx` → Tailwind classes
- `src/components/AnimatedValue.tsx` → Tailwind classes
- `src/components/LogoMark.tsx` → Tailwind classes
- `vite.config.ts` → add `@tailwindcss/vite` plugin

### What stays in CSS (not Tailwind)
- Background orb `@keyframes` drift animations
- Sparkline SVG fill/stroke styles
- Google Fonts `@import`
- Complex `backdrop-filter` / `perspective` tilt card effects

---

## Phase 3 — Light/Dark Mode

### `useTheme` hook (`src/hooks/useTheme.ts`)
- On mount: read `localStorage.getItem('wap.theme')`. If absent, check `window.matchMedia('(prefers-color-scheme: dark)')`.
- Apply `dark` class to `document.documentElement`.
- Toggle function: flip class, persist to localStorage.
- Returns `{ theme: 'light' | 'dark', toggleTheme }`.

### Theme toggle button
- Placed in the hero header, top-right corner.
- Inline SVG sun icon (light mode) / moon icon (dark mode) — no icon library.
- `aria-label="Switch to light mode"` / `"Switch to dark mode"`.

### Color palettes

**Dark (existing):**
- Background: `#000` / `#04040a`
- Surface: `rgba(255,255,255,0.04)` borders
- Text: `#f3f3f3` / `#c2c2c7`
- Green: `#50ffb0`, Red: `#ff6b8a`
- Accents: blue `#60b8ff`, purple `#b89cff`, cyan `#4df0e0`

**Light:**
- Background: `#f8fafc` (slate-50)
- Surface: `white` with `#e2e8f0` (slate-200) borders
- Text: `#0f172a` (slate-900) / `#475569` (slate-600)
- Green: `#059669` (emerald-600), Red: `#e11d48` (rose-600)
- Accents: same hue, adjusted lightness for contrast
- Background orbs: 40% opacity of dark values

---

## Phase 4 — "Last Updated" Timestamp

Add formatted `generatedAt` display in the status bar.

**Current:** `Live market data · refresh in 28s`
**New:** `Live market data · Updated 14:32:05 · refresh in 28s`

- Format using `Intl.DateTimeFormat` with `timeStyle: 'medium'` (locale-aware, no dependency).
- Only show when `dashboard?.generatedAt` is a valid date.
- `aria-hidden="true"` on the timestamp span (the `aria-label` on the status div already describes refresh behavior).

---

## Phase 5 — README Rewrite

**Brand:** World Asset Prices (not Cryptoprice)
**Repo URL:** `https://github.com/coleyrockin/cryptoprice` (keep as-is, it's the GitHub URL)

### Sections
1. Title: `# World Asset Prices`
2. Badges: React, TypeScript, Vite, TanStack Query, Framer Motion, Tailwind CSS, Vitest, Playwright, MIT
3. Live demo link: `**Live:** [world-asset-prices.vercel.app](https://world-asset-prices.vercel.app)` (placeholder)
4. Screenshot: `![Dashboard preview](docs/site-preview.png)`
5. One-liner description
6. Features list (all current features)
7. Tech stack table
8. Getting started (clone, install, dev)
9. Environment variables (`COINPAPRIKA_BASE_URL`, `FMP_API_KEY`, etc. from `.env.example`)
10. Available scripts table
11. Project structure tree
12. Contributing section (fork, branch, PR)
13. License: MIT

---

## Phase 6 — Build Verification

1. `npm run typecheck` — must pass
2. `npm run lint` — must pass
3. `npm run test` — must pass
4. `npm run build` — must pass
5. `npm run check:bundle` — must pass

---

## Constraints & Non-Goals

- Do NOT change server-side logic (`server/`, `api/`) — data layer is solid
- Do NOT change test assertions — only update class names in snapshot tests if any
- Do NOT add new npm dependencies beyond Tailwind v4 and its Vite plugin
- Do NOT change the component structure — only styling
- Keep `clsx` for conditional classes (already a dep)

# Site Improvements Design

**Date:** 2026-05-01
**Status:** Approved by user shorthand: "everything go"

## Goal

Improve the existing World Asset Prices dashboard across visual quality, usability, accessibility, and mobile scanning without changing the backend API contract.

## Approach

Use the current single-page React layout and add client-only dashboard tools:

- Hero insight rail with total tracked markets, data health, largest mover, and top global asset.
- Control bar with search, section filter, sort mode, and compact comfortable density.
- Pinned watchlist using existing `MarketCard` pin support and localStorage persistence.
- Better empty states when filters hide a section.
- Responsive CSS polish for dense market cards, control wrapping, and mobile nav.

## Alternatives Considered

1. **Pure visual redesign:** lower risk but misses the biggest usability gap: finding and comparing items across 50+ cards.
2. **Backend ranking/data expansion:** potentially useful, but higher risk and not needed for a site-quality pass.
3. **Client-side intelligence pass:** best impact-to-risk ratio because it improves discovery, scanning, and perceived product quality while preserving data contracts.

## Scope

In scope:

- `src/App.tsx`
- `src/globals.css`
- new client helper module and tests
- focused App tests

Out of scope:

- Changing provider logic, server cache behavior, or API shape
- Adding new dependencies
- Replacing the existing aesthetic direction

## Verification

Run:

- `npm run test -- src/lib/dashboard-insights.test.ts src/App.test.tsx`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

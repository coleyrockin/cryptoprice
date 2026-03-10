# Roadmap

This file outlines planned features and improvements for World Asset Prices.

## Near-term

- **OHLC / candlestick charts** — Add sparkline or mini candlestick charts to each `MarketCard` so users can see short-term price history at a glance.
- **Currency selector** — Allow users to switch the display currency (USD, EUR, GBP, JPY) using exchange-rate conversion on the frontend.
- **Expanded asset coverage** — Add commodities (gold, silver, oil) and bond indices to the existing crypto/stock/global-assets sections.
- **Persistent watchlist sync** — Optionally sync the watchlist to a backend so it is preserved across devices (e.g., via Vercel KV or a lightweight user account).
- **Accessible color theme toggle** — Provide a light mode alongside the current dark/glassmorphism theme, with preference saved in `localStorage`.

## Mid-term

- **Server-Sent Events (SSE) price stream** — Replace the polling model with a push-based SSE endpoint so prices update in real time without repeated HTTP round-trips.
- **Portfolio tracker** — Let users enter holdings and quantities; compute and display a personal portfolio value alongside the market dashboard.
- **Provider redundancy** — Add a secondary data provider for each segment so the dashboard can automatically fall back during a primary outage without serving stale data.
- **Notifications** — Browser-native price-change notifications for watched assets (e.g., alert when BTC moves ±5% in 24 h).
- **Internationalisation (i18n)** — Add locale-aware number and currency formatting; lay groundwork for translating UI strings.

## Long-term

- **Mobile app shell** — Package the frontend as a Progressive Web App (PWA) with an offline-capable service worker.
- **Historical data view** — Provide a dedicated chart page with selectable time ranges (1 D, 7 D, 30 D, 1 Y) powered by a cached historical-data endpoint.
- **Public API** — Expose the aggregated `/api/dashboard` and `/api/health` endpoints as a documented public API with API-key authentication and usage quotas.
- **Test coverage expansion** — Reach ≥ 80 % branch coverage across server and frontend; add visual regression tests for `MarketCard` states.
- **Performance budget enforcement** — Extend `check:bundle` to cover per-chunk limits and track bundle size trends over time in CI.

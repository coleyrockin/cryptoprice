# World Asset Prices Roadmap

This roadmap separates what is already shipped from the realistic next product slices. It intentionally avoids promising paid data feeds or account systems until the free-provider MVP is fully stable.

## Shipped

- **Unified market dashboard** - Global assets, stocks, private companies, ETFs, fiat currencies, cryptocurrencies, and the Midnight Token panel.
- **Resilient data pipeline** - Live provider data, fresh cache, stale cache, optional durable KV cache, and bundled fallback data.
- **Data-health transparency** - Segment source labels, degraded-count summary, and per-section freshness badges.
- **Price-derived public-market valuations** - Stock market caps and ETF AUM estimates scale from baseline share/unit snapshots using live prices.
- **Private-company section** - Curated private-company valuations with grid parity for filtering, sorting, pinning, compact mode, and empty states.
- **Asset detail drawer** - Per-asset quote, provenance, confidence, limitation copy, and stock/ETF historical charts without expanding the compact dashboard payload.
- **Local Portfolio Lab** - Browser-only holdings, allocation, optional gain/loss, edit/remove controls, and JSON import/export for tradable assets.
- **Security hardening** - Logo proxy validation, trusted-proxy rate-limit keys, provider origin validation, CSP headers, and bounded client-error logging.
- **Release gates** - Lint, typecheck, unit tests, route tests, production build, bundle budget, E2E smoke tests, and dependency audit.

## Next

- **Provider redundancy** - Add secondary stock/ETF fundamentals coverage so public-market values can recover without falling back to stale snapshots.
- **Broader historical coverage** - Add no-key history providers for crypto, currencies, commodities, private companies, and NIGHT.
- **Currency selector** - Let users view dashboard values in USD, EUR, GBP, and JPY using cached exchange-rate conversion.
- **Portfolio scenarios** - Add rebalance targets, what-if price changes, and stronger import/export validation.
- **Watchlist sync** - Optionally sync pinned assets through a lightweight backend store while keeping local-only mode available.

## Later

- **SSE price stream** - Replace periodic polling with a server-sent event stream for lower-latency updates.
- **Notifications** - Browser-native alerts for large moves in watched assets.
- **Internationalization** - Locale-aware formatting and translatable interface copy.
- **PWA shell** - Offline-capable app install flow for mobile and desktop.
- **Visual regression coverage** - Snapshot key dashboard states across responsive breakpoints and themes.
- **Public API mode** - Documented API access with authentication, quotas, and explicit stability guarantees.

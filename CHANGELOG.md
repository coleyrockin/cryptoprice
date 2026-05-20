# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Yahoo Finance v8 `/chart` endpoint as the primary keyless history provider for stocks and ETFs. The asset detail drawer now populates real 7D / 30D / 1Y points (adjusted close preferred). Stooq CSV history is retained as an opportunistic fallback.
- `AssetRef.supportsHistory` reflects per-entry capability: `true` for stocks and ETFs that resolve a live unit price, `false` for entries that only carry curated valuations.

### Changed

- Live-computed market caps and AUM derived from price × share/unit baselines, with rankings auto-recomputed from current values so the dashboard's top-of-list stays accurate even when prices move.
- Equity quote pipeline now batches Stooq with Yahoo Finance v7 quote fallback when Stooq is missing symbols.
- Source disclosure now carries `equityFundamentalsAsOf` and `valueSourceVersion` for transparency about the most recent baseline reconcile.

## [0.1.0] — 2026-03-10

### Added

- Full-stack reliability architecture with unified `GET /api/dashboard` API contract.
- Segment-level degradation metadata (`degradedSegments`, `segmentMeta`) and request IDs.
- Security hardening for logo proxy:
  - allowlisted hosts
  - payload-size limits
  - timeout controls
  - lightweight in-memory rate limiting.
- Hardened client error ingestion with schema validation, payload limits, and rate limiting.
- Structured operational logging and expanded health readiness checks.
- Route-level API test suite (`api/*.test.ts`) for dashboard, health, logo, and client-error routes.
- Additional unit tests for security and rate-limiting helpers.
- Expanded smoke E2E coverage for stale/degraded states and logo fallback behavior.
- Bundle-budget guard script (`npm run check:bundle`).
- ROADMAP.md listing planned features and improvements.

### Changed

- **Renamed project from Cryptoprice to World Asset Prices.** All user-visible text, HTTP headers (`X-Wap-*`), internal identifiers, cache keys, localStorage keys, and documentation updated. Existing watchlists are automatically migrated.
- CI workflow now enforces lint, typecheck, unit/integration tests, route tests, build, bundle budget, and E2E smoke checks.
- `npm run check` now runs the complete local validation gate sequence.
- README and contributing docs updated to reflect current architecture, contracts, and quality standards.
- Package metadata and keywords updated for clearer professional positioning.
- Preview images moved from repository root to `docs/` for a cleaner project structure.

[0.1.0]: https://github.com/coleyrockin/world-asset-prices/releases/tag/v0.1.0

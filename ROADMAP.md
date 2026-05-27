# World Asset Prices Roadmap

Last updated: 2026-05-27

## 1) Project summary
A no-key, full-stack market dashboard that serves ranked public assets, private-company valuations, ETFs, FX, crypto, and a local portfolio lab behind a resilient `/api/dashboard` + `/api/asset-detail` contract. The current implementation is production-stable for static and live hosts, but it depends on volatile free providers and curated snapshots for some assets. The roadmap below is execution-ready for the next agent, without changing production logic or UI foundations.

## 2) Current product vision
Track globally relevant assets with clear freshness/provenance signals, keep local-only portfolio workflows fast and private, and keep the experience robust when providers fail.

## 3) Target users
- Students/project recruiters evaluating engineering quality and architecture.
- Early market-ops / finance learners wanting a live multi-asset snapshot.
- Frontend users who value fast local state and transparent data confidence.
- Contributors extending public-data pipelines and observability.

## 4) What is already finished

### Phase 1 (shipped)
- Public/live segments with resilient cache + durable fallback behavior.
- Per-segment stale/degraded labels (`live`, `fresh-cache`, `stale-cache`, `durable-cache`, `fallback`).
- Asset detail provenance for all card types, including source type, confidence, method, and limitation context.
- Portfolio Lab with tradable asset filtering and local persistence.
- GitHub Pages static mirror path for dashboard and detail JSON when backend is unavailable.
- Data quality audit script, production verification script, static smoke coverage, and release gates in CI.

### Phase 2 (shipped 2026-05)
- Asset Detail Drawer (`AssetDetailDrawer.tsx`) with 30D/90D/1Y Yahoo v8 chart history, code-split via `React.lazy`.
- `api/asset-detail.ts` endpoint returning historical price points.
- Portfolio Lab (`PortfolioLab.tsx`) with tradable-asset filtering.

### Provider resilience (shipped 2026-05-26)
- **3-tier equity quote fallback**: Stooq CSV → Yahoo Finance v7 quote → Yahoo Finance v8 chart. The v8 chart tier was added after Stooq and Yahoo v7 both failed from Vercel egress IPs, causing a 5.5-day equity outage.
- **Daily fallback snapshot refresh** (`.github/workflows/refresh-fallback.yml`): Cron at 06:30 UTC runs `scripts/refresh-fallback.mjs`, which fetches the live `/api/dashboard`, validates it is clean (no degraded segments, not on fallback itself), and commits the updated snapshot. Prevents stale bundled fallback during future provider outages.

## 5) Operational gaps — P0 (must fix before next outage)

### [P0] Provision Upstash Redis durable cache
- **What**: `server/durable-cache.ts` already reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` but neither is set in Vercel production. `isDurableCacheConfigured()` returns false on every cold start.
- **Why**: Without it, each Vercel function cold start re-fetches all providers simultaneously. High-traffic spikes or multiple cold starts simultaneously hammer Stooq/Yahoo in parallel, increasing the probability of rate-limiting.
- **How**: `vercel integration add upstash/upstash-kv --environment production` (requires interactive auth — must be done manually in Vercel dashboard). Env vars inject automatically.
- **Impact**: Cached segment data survives across Vercel instances; partial provider failure affects only one refresh cycle instead of every user.
- **Difficulty**: Low (infrastructure only, no code changes).
- **Risk**: Low.
- **Acceptance criteria**: `isDurableCacheConfigured()` returns true in production; `segmentMeta` shows `durable-cache` source for at least one warm segment.

### [P0] Add external alerting for provider failures
- **What**: A 5.5-day equity outage (2026-05-20 → 2026-05-26) was caught only by manual audit — no automated alert fired. `server/metrics.ts` and `server/health.ts` exist but have no external alert sink.
- **Why**: `degradedSegments` array being non-empty in production is an on-call event. No human will notice without an alert.
- **Options**: GitHub Actions scheduled job hitting `/api/dashboard` and failing if `degradedSegments.length > 0`; or Vercel cron + email/Discord webhook; or Upstash QStash.
- **Acceptance criteria**: An alert fires within 30 minutes of `degradedSegments` becoming non-empty in production.
- **Difficulty**: Low–Medium.
- **Risk**: Low.

## 6) Infrastructure gaps — P1

### [P1] CDN cache headers on `/api/dashboard` — shipped 2026-05-27
- **What**: `/api/dashboard` now returns `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.
- **Why**: With ~51 tracked assets refreshed server-side on a 30-second client polling loop, Vercel Function invocations are 2× per minute per concurrent user. CDN caching at even 15–30s would dramatically reduce function invocations.
- **Tradeoff**: Dashboard freshness would lag by up to `s-maxage` seconds; the `generatedAt` timestamp already communicates data age.
- **Acceptance criteria**: `curl -sD - -o /dev/null https://world-asset-prices.vercel.app/api/dashboard` shows `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` after deployment.
- **Difficulty**: Low.
- **Risk**: Low.

### [P1] Pause client polling for background tabs
- **What**: 30-second polling runs unconditionally even when the browser tab is hidden.
- **Why**: Wastes Vercel Function invocations and battery on mobile for tabs the user isn't looking at.
- **How**: Add a `document.addEventListener("visibilitychange", ...)` listener; pause the polling interval when `document.hidden === true`, resume on visibility restore.
- **Files**: `src/hooks/useDashboardData.ts` (or wherever polling lives).
- **Acceptance criteria**: Network tab shows no `/api/dashboard` calls while tab is backgrounded.
- **Difficulty**: Low.
- **Risk**: Low.

### [P1] Node version parity between CI and production — shipped 2026-05-27
- **What**: `.github/workflows/*`, `.nvmrc`, `package.json`, and contributor docs now target Node 24.
- **Why**: Fetch API behavior, URL parsing, and stream handling can change between Node majors. Running CI on the production major reduces production-only failure risk.
- **How**: Keep workflow `node-version` values at `"24"`.
- **Difficulty**: Low.
- **Risk**: Low.

### [P1] Stale equity fundamentals require manual code commits
- **What**: `EQUITY_FUNDAMENTALS_AS_OF = "2026-05-14"` and share counts (e.g., NVDA: 24.3B shares, AAPL: 14.7B shares) in `server/providers/stooq.ts` are hardcoded strings. Share dilution, buybacks, and stock splits make these stale over months.
- **Why**: Market cap = price × shares. A 5% share count drift produces a 5% market cap error in rankings.
- **Options**: A quarterly GitHub Actions job that fetches shares outstanding from a keyless source (macrotrends, simplywall, or a curated manual review) and auto-commits; or at minimum, a contributor checklist in docs.
- **Acceptance criteria**: Either automated refresh exists or a documented quarterly review cadence exists with an owner.
- **Difficulty**: Medium.
- **Risk**: Low.

### [P1] Private company valuations require code commits to update
- **What**: Private company valuations (SpaceX, OpenAI, Stripe, etc.) and the NIGHT token special case are hardcoded in server-side JSON/TS files.
- **Why**: These valuations are from news/funding rounds that happen irregularly. Currently, updating one requires a code change, PR, and deploy.
- **Options**: Extract to a separate JSON config file that can be updated without touching application logic; optionally, allow a CI cron to pull from Crunchbase/PitchBook public endpoints if available.
- **Difficulty**: Medium.
- **Risk**: Low.

### [P1] Saudi Aramco and Samsung have permanent null prices
- **What**: `2222.SR` (Saudi Aramco) and `005930.KS` (Samsung) have `priceUsd: null` because no keyless provider covers Saudi or Korean exchanges. Market cap is hardcoded and will drift.
- **Why**: These are two of the world's top-15 companies by market cap and are shown in the "Global Assets" ranking with no live price.
- **Options**: Use Stooq's Korean/Saudi symbols if available; fall back to a keyless scraper with strict error handling; or mark them explicitly as "estimate only" in the UI with a tooltip.
- **Difficulty**: Medium–High.
- **Risk**: Medium (scraping is fragile).

## 7) Code quality gaps — P2

### [P2] Framer Motion is the largest vendor chunk (39.64 KB gzip)
- **What**: `motion-vendor` accounts for 39.64 KB of the 70.6 KB gzipped bundle.
- **Why**: If most animations are entry/exit transitions achievable with CSS, Framer Motion may be oversized for the use case.
- **Options**: Audit which Framer features are actually used; replace simple fade/slide animations with CSS `@keyframes`; or import only `motion/react` subpath instead of full Framer.
- **Acceptance criteria**: `npm run check:bundle` reports motion-vendor ≤ 20 KB gzip without removing any visible animations.
- **Difficulty**: Medium.
- **Risk**: Medium (visual regression risk).

### [P2] `PortfolioLab.tsx` test coverage unknown
- **What**: The Portfolio Lab feature shipped in Phase 2 but test coverage depth is unclear.
- **Why**: Local storage keys (`wap.portfolio.v1`) and portfolio value calculation logic are high-risk if broken silently.
- **Acceptance criteria**: At least one route test for portfolio calculation; at least one E2E smoke test for the Portfolio Lab panel.
- **Difficulty**: Low–Medium.
- **Risk**: Low.

### [P2] No E2E test for degraded/fallback UI state
- **What**: The data health banner shows "Degraded" when `degradedSegments` is non-empty, but there is no automated test that verifies the degraded UI path.
- **Why**: The degraded state is the most important correctness guarantee — if it silently regresses, users see stale data with no warning.
- **Acceptance criteria**: E2E test that mocks a degraded API response and confirms the health banner shows "Degraded" with the correct segment list.
- **Difficulty**: Medium.
- **Risk**: Low.

### [P2] Search does not match by category
- **What**: The search input matches symbol and name only. Searching "ETF", "crypto", or "private" returns no results.
- **Why**: Users discovering the dashboard for the first time may try category search before they know specific symbols.
- **Acceptance criteria**: Searching "ETF" returns all ETF cards; searching "crypto" returns crypto cards.
- **Difficulty**: Low.
- **Risk**: Low.

### [P2] Sort by "Move" does not distinguish positive vs negative
- **What**: Sorting by largest % move ranks +10% and −10% moves equivalently by absolute value. The sort order presents them identically.
- **Why**: A user looking for "what moved the most today" usually cares about direction.
- **Options**: Split into "Top Gainers" and "Top Losers" sort modes; or use signed sort by default.
- **Difficulty**: Low.
- **Risk**: Low.

## 8) UX improvements — P3

### [P3] Pause-on-hidden tab polling
Listed under P1 (Infrastructure) because it has direct cost impact.

### [P3] In-card sparklines on main dashboard
- **What**: Historical sparklines (7D or 30D) are only visible in the Asset Detail Drawer. The main dashboard cards show no trend data.
- **Why**: A user scanning the dashboard for "what's trending" currently has no visual trend signal without opening each drawer.
- **Difficulty**: Medium.
- **Risk**: Low. (v8 chart history per-symbol already works via `api/asset-detail`.)

### [P3] NIGHT token contextual labeling
- **What**: The NIGHT (Midnight Network) token appears alongside NVIDIA, gold, and SPY with no context about what it is or why it's tracked.
- **Why**: Casual users are likely to misread its presence as an editorial endorsement or mainstream comparison.
- **Options**: Add a tooltip or label ("Experimental — not investment advice"); move to a separate "Watch" or "Emerging" category.
- **Difficulty**: Low.
- **Risk**: Low.

### [P3] Pinned markets are device-local only
- **What**: Pins are stored in `wap.pinned-markets.v1` in `localStorage` — no cross-device sync.
- **Why**: Users returning on a different device or browser lose all pins.
- **Options**: Optional account-free sync via a shareable URL hash; or Vercel KV (once provisioned for durable cache) with an anonymous session ID.
- **Difficulty**: Medium.
- **Risk**: Low.

### [P3] Stooq CSV becoming sole equity path risk
- **What**: If Stooq begins requiring an API key for the quote CSV endpoint (as it has been signaling with the history endpoint since mid-2026), Yahoo v8 chart becomes the sole real-time equity source.
- **Why**: Yahoo v8 chart returns only the last closing price — no volume, open/high/low. Market cap calculations depend on price accuracy but the changePercent computation from open vs. close is an approximation.
- **Mitigation**: Monitor Stooq HTTP response behavior in the daily fallback refresh workflow; add a CI assertion that at least one of the 3 tiers returns a non-null price for NVDA.
- **Difficulty**: Low (monitoring) / High (finding a Stooq replacement).

### [P3] PWA manifest and offline support missing
- **What**: No `manifest.json` or service worker. The app cannot be installed as a PWA.
- **Why**: On mobile, "Add to Home Screen" works but shows generic browser chrome. Offline behavior is blank page.
- **Difficulty**: Medium.
- **Risk**: Low.

## 9) What should be protected and not broken
- Public API contracts for `/api/dashboard` and `/api/asset-detail`.
- Segment-level source states and fallback semantics.
- Local storage keys: `wap.portfolio.v1`, `wap.pinned-markets.v1`, `wap.prefs.v1`.
- No-key and static deployment assumptions (GitHub Pages behavior).
- Security guardrails (`server/client-key.ts`, `server/security.ts`, `api/*` request validation).

## 10) Current verification status (2026-05-26)
- `npm run lint`: passed.
- `npm run test`: passed (20 files, 78 tests + new v8 chart fallback test).
- `npm run test:routes`: passed (6 files, 33 tests).
- `npm run build`: passed.
- `npm run audit:data`: passed.
- `npm run check:bundle`: passed (main chunk 227 KB / 70.6 KB gzip; budget 420 KB).
- `npm audit --omit=dev`: 0 vulnerabilities.
- Provider status post-deploy: 3-tier equity fallback active; v8 chart tier resolving NVDA live.
- Fallback snapshot age: still 2026-05-16; `refresh-fallback.yml` scheduled cron will update at 06:30 UTC; manual `workflow_dispatch` available.

## 11) Architecture recommendations
- Enforce a single source-of-truth table for data provenance and snapshot assumptions.
- Add explicit section-level dependency map: which providers feed each segment and what fallback applies.
- Keep provider contracts additive and avoid hidden behavior changes in API consumers.
- Preserve current `api` and `src` split to avoid cross-layer coupling.
- Once Upstash Redis is provisioned, verify `durable-cache.ts` hit rate via Upstash console before assuming it's working.

## 12) Refactor recommendations
- Move share counts and `EQUITY_FUNDAMENTALS_AS_OF` to a versioned config file outside the main provider module.
- Move private company valuations to a standalone JSON/TS config with a clear "last reviewed" date field.
- Consider consolidating `server/cache.ts` (in-memory) and `server/durable-cache.ts` (Redis) behind a single `CacheAdapter` interface to simplify `server/dashboard.ts` logic.

## 13) Performance recommendations
- Add `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` to `/api/dashboard` responses.
- Pause polling on hidden tabs (`visibilitychange`).
- Audit Framer Motion usage — if only CSS transitions are needed, `motion-vendor` gzip can halve.
- Keep current chunking strategy and bundle budget.

## 14) Security recommendations
- Keep current header policies and no-change to `/api/client-error` logging model unless new requirements appear.
- Add operational guidance for token/secret handling and rotate env var conventions in `SECURITY.md`.
- Include an explicit checklist for `TRUST_PROXY_HEADERS` and Vercel-only assumptions.

## 15) Testing strategy
- Unit + route: unchanged commands.
- E2E: add degraded-state smoke test (mock `degradedSegments: ["equities"]` and assert health banner).
- E2E: add Portfolio Lab panel open/calculation smoke test.
- Contract: confirm dashboard payload shape and detail payload shape remain additive.
- Data governance: continue `npm run audit:data` with manifest drift checks.
- Production checks: continue scheduled verifier plus manual review on each milestone completion.

## 16) CI/CD recommendations
- Keep all CI `node-version` values pinned to `"24"` for parity with Vercel production.
- Add a scheduled CI job (or extend `refresh-fallback.yml`) to fail if `degradedSegments` is non-empty in production.
- Keep GitHub Pages build command pinned to static-only mode and static smoke after deploy.
- Keep dependency-review job; surface output in release notes.

## 17) Documentation improvements
- Add a short "Current limitations" block in `README.md` with severity labels.
- Link `ROADMAP.md`, `CHANGELOG.md`, `security_best_practices_report.md` directly from README.
- Add release status section with last verification command run and timestamp.
- Document the 3-tier equity provider chain and which tier is active in production.
- Add a "Data Maintenance Cadence" section: who reviews share counts, when private valuations are refreshed, how to trigger a manual fallback refresh.

## 18) Recommended milestone order
1. **P0 now**: Provision Upstash Redis durable cache (manual Vercel dashboard step).
2. **P0 now**: Add external alerting for `degradedSegments`.
3. **P1 next sprint**: tab visibility polling pause; data maintenance cadence; external alerting follow-through.
4. **P1 next sprint**: Document share count and private valuation review cadence.
5. **P2**: E2E tests for degraded state and Portfolio Lab; search category matching; sort direction fix.
6. **P3**: In-card sparklines; NIGHT labeling; bundle slim (Framer audit).
7. **Future**: Cross-device pin sync; PWA manifest; Stooq replacement monitoring.

## 19) Production readiness checklist
- [x] No unresolved verification failures in `npm run lint`, `npm run test`, `npm run test:routes`, `npm run build`, `npm run check:bundle`, `npm run audit:data`.
- [x] 3-tier equity provider fallback in place (Stooq → Yahoo v7 → Yahoo v8 chart).
- [x] Daily fallback snapshot refresh CI deployed.
- [x] `/api/dashboard` cache-control header implemented for CDN revalidation.
- [x] CI, local Node hints, package engine, and docs aligned on Node 24.
- [ ] Upstash Redis env vars provisioned in Vercel production.
- [ ] External alert configured for `degradedSegments`.
- [ ] Fallback snapshot refreshed to today's date (run workflow manually once prod is confirmed clean).
- [x] Static deployment smoke covers no `/api/*` calls and can open stock/private detail.
- [x] Data manifest and fallback files include source URLs + date fields.
- [x] Top-segment ordering remains correct when stale/fallback path is active.
- [x] README + ROADMAP in sync with current behavior.

## 20) Next Agent Instructions

### Immediate manual actions (cannot be automated)
1. In Vercel dashboard → Integrations → add Upstash KV → bind to `world-asset-prices` production.
2. Once env vars appear, verify with `vercel env ls --environment=production | grep KV`.
3. Trigger `.github/workflows/refresh-fallback.yml` via `workflow_dispatch` once `degradedSegments` is confirmed empty in production.

### First 5 code tasks
1. Add `visibilitychange` polling pause to the data-fetch hook if React Query behavior is not sufficient in browser network traces.
2. Add E2E test for degraded banner state.
3. Add Portfolio Lab E2E calculation coverage.
4. Add external alerting for production `degradedSegments`.
5. Add documented quarterly review cadence for share counts and private valuations.

### Commands before making logic changes
```
git status --short
npm run lint
npm run test
npm run test:routes
npm run audit:data
```

### Commands after any code edit
```
npm run check:bundle
npm run build
npm audit --omit=dev
```

### What not to break
- `/api/dashboard` and `/api/asset-detail` payload fields.
- Static deployment behavior (`GITHUB_PAGES` paths and fallback JSON generation).
- Segment source labels and health state semantics.
- Local storage keys used by preferences, watchlist, and portfolio.
- The 3-tier equity provider order: Stooq → Yahoo v7 → Yahoo v8 chart.

### When to stop and ask for human review
- Any change that touches `/api/dashboard`, `/api/asset-detail`, or provider endpoints.
- Any change that modifies `segmentMeta`, `degradedSegments`, or fallback selection logic.
- Any security headers, rate-limiting, or proxy validation changes.

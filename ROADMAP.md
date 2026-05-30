# World Asset Prices — Roadmap

Last updated: 2026-05-29

---

## 1. Project Summary

A no-key, full-stack market dashboard tracking **90 assets across 6 categories** — public companies, private companies, ETFs, fiat currencies, cryptocurrencies, and global asset composites — with a resilient 3-tier fallback API, per-segment freshness metadata, and a local-only portfolio simulator. Production-stable on Vercel; static mirror available on GitHub Pages.

---

## 2. Product Vision

Track the world's most significant assets with transparent data confidence. Keep local portfolio workflows fast and private. Stay robust through provider failures without the user ever needing an API key.

---

## 3. Target Users

| Audience | What they care about |
|---|---|
| Students & recruiters | Engineering quality, architecture, and code clarity |
| Finance learners | Live multi-asset snapshot with provenance transparency |
| Frontend users | Fast local state and honest data-confidence signals |
| Contributors | Extensible public-data pipelines and observability hooks |

---

## 4. What Is Already Shipped

### Phase 1 — Foundation
- 6 market segments (Public Companies, Private Companies, ETFs, Currencies, Cryptos, Global Assets) with 15 entries each
- Resilient 3-tier equity fallback: Stooq CSV → Yahoo Finance v7 → Yahoo Finance v8 chart
- Per-segment freshness labels: `live`, `fresh-cache`, `stale-cache`, `durable-cache`, `fallback`
- Asset Detail Drawer with 30D/90D/1Y historical chart (Yahoo v8), code-split via `React.lazy`
- Portfolio Lab — local-only simulator with tradable-asset filtering, import/export JSON, unrealized P&L
- GitHub Pages static mirror with fallback JSON for zero-backend deployments
- Daily fallback snapshot refresh CI (`.github/workflows/refresh-fallback.yml`)

### Phase 2 — Reliability (2026-05)
- Asset Detail provenance: source type, confidence method, limitation context, `equityFundamentalsAsOf`
- Live market cap / AUM auto-recomputed from current price × share baseline (not hardcoded snapshots)
- Equity quote pipeline batches Stooq with Yahoo v7 fallback for missing symbols
- CDN cache headers on `/api/dashboard` — `s-maxage=30, stale-while-revalidate=60`
- CI: lint, typecheck, unit tests, route tests, build, bundle budget, E2E smoke, Node 24 parity
- Data quality audit script, production verification script, static smoke coverage

### Phase 3 — Polish (2026-05-29)
- Expanded to **15 assets per category** (up from 10)
- NIGHT token removed from UI — server API contract preserved for backward compatibility
- Bundle: main chunk 227 KB / 70.6 KB gzip; motion-vendor 39.64 KB gzip (within budget)
- All checks green: lint, typecheck, 78 unit tests + 33 route tests, build, bundle

---

## 5. P0 — Must Fix Before Next Outage

### Provision Upstash Redis durable cache
`server/durable-cache.ts` reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` but neither env var is set in Vercel production. Every cold start re-fetches all providers simultaneously.

**How:** Vercel Dashboard → Integrations → Upstash KV → bind to `world-asset-prices` production. Env vars inject automatically.

**Impact:** Cached segment data survives across Vercel instances; partial provider failure no longer affects every concurrent user on the same cold-start window.

**Acceptance:** `isDurableCacheConfigured()` returns `true`; at least one `segmentMeta` segment shows `durable-cache` source.

**Difficulty:** Low (infrastructure only, no code changes). **Risk:** Low.

---

### Add external alerting for provider failures
A 5.5-day equity outage (2026-05-20 → 2026-05-26) was caught by manual audit only. `degradedSegments` being non-empty in production is an on-call event — no alert fires.

**Options:**
- GitHub Actions scheduled job hitting `/api/dashboard` → fail if `degradedSegments.length > 0`
- Vercel cron + Discord/email webhook
- Upstash QStash trigger

**Acceptance:** Alert fires within 30 minutes of `degradedSegments` becoming non-empty.

**Difficulty:** Low–Medium. **Risk:** Low.

---

## 6. P1 — Next Sprint

### Pause polling on background tabs
30-second polling runs even when `document.hidden === true`. Wastes Vercel Function invocations and battery on mobile.

**How:** `visibilitychange` listener in `src/hooks/useDashboardData.ts` — pause when hidden, resume on visible.

**Acceptance:** No `/api/dashboard` calls in Network tab while tab is backgrounded.

**Difficulty:** Low. **Risk:** Low.

---

### Stale equity fundamentals require manual code commits
`EQUITY_FUNDAMENTALS_AS_OF` and per-company share counts are hardcoded in `server/providers/stooq.ts`. Share dilution, buybacks, and splits make these stale over months. A 5% share-count drift = 5% market-cap ranking error.

**Options:**
- Quarterly GitHub Actions job fetching shares outstanding from a keyless source
- Documented contributor checklist with a clear owner

**Acceptance:** Either automated refresh exists, or a documented quarterly review cadence with an owner exists.

**Difficulty:** Medium. **Risk:** Low.

---

### Private company valuations require code commits to update
SpaceX, OpenAI, Stripe valuations are hardcoded in server-side TS files. Every valuation update requires a PR and deploy.

**Option:** Extract to a versioned JSON config file outside application logic with a `lastReviewedAt` field.

**Difficulty:** Medium. **Risk:** Low.

---

### Saudi Aramco and Samsung have permanent null prices
`2222.SR` and `005930.KS` show `priceUsd: null` — no keyless provider covers Saudi or Korean exchanges. Market cap is hardcoded and drifts.

**Options:**
- Stooq Korean/Saudi symbol coverage check
- Mark explicitly as "estimate only" with tooltip in the UI

**Difficulty:** Medium–High. **Risk:** Medium.

---

## 7. P2 — Code Quality

| Item | Description | Difficulty |
|---|---|---|
| **E2E degraded-state test** | Mock `degradedSegments: ["topStocks"]`, assert health banner shows correct segment | Medium |
| **Portfolio Lab E2E coverage** | Smoke test add/remove holding + P&L calculation via localStorage | Low–Medium |
| **Category search** | Search "ETF", "crypto" should return matching cards — currently only name/symbol match | Low |
| **Sort by move: signed direction** | `+10%` and `−10%` currently tie; offer "Top Gainers" / "Top Losers" split | Low |
| **Framer Motion audit** | `motion-vendor` is 39.64 KB gzip; audit if CSS `@keyframes` can replace simple fade/slide | Medium |

---

## 8. P3 — UX Improvements

### In-card sparklines on the main dashboard
7D or 30D sparklines inline on each card so users can scan trends without opening the detail drawer. Yahoo v8 chart history is already fetched per-symbol — this is a rendering concern only.

**Difficulty:** Medium. **Risk:** Low.

### Pinned markets: cross-device sync
Pins are stored in `wap.pinned-markets.v1` (localStorage). A user on a different device loses all pins.

**Options:** Shareable URL hash; or Vercel KV anonymous session (once Upstash is provisioned).

**Difficulty:** Medium. **Risk:** Low.

### PWA manifest and offline support
No `manifest.json` or service worker. Mobile "Add to Home Screen" shows generic browser chrome. Offline = blank page.

**Difficulty:** Medium. **Risk:** Low.

### Stooq CSV provider risk monitoring
If Stooq requires an API key (signaling since mid-2026), Yahoo v8 chart becomes the sole equity source. Yahoo v8 returns only last close — no volume, open/high/low; `changePercent` becomes an approximation.

**Mitigation:** CI assertion that at least one of the 3 tiers returns a non-null price for NVDA; monitor Stooq HTTP response codes in the daily fallback refresh workflow.

**Difficulty:** Low (monitoring) / High (finding replacement). **Risk:** Medium.

---

## 9. Inviolable Constraints

These must never be broken regardless of what changes:

| Contract | Details |
|---|---|
| **API payload shape** | `/api/dashboard` and `/api/asset-detail` fields are additive only |
| **Segment source semantics** | `live`, `fresh-cache`, `stale-cache`, `durable-cache`, `fallback` labels must remain accurate |
| **localStorage keys** | `wap.portfolio.v1`, `wap.pinned-markets.v1`, `wap.prefs.v1` — changing breaks existing user data |
| **Static deployment** | `GITHUB_PAGES` path and fallback JSON must work without any `/api/*` calls |
| **3-tier equity order** | Stooq CSV → Yahoo v7 → Yahoo v8 chart — do not reorder |
| **Security guardrails** | `server/client-key.ts`, `server/security.ts`, rate limiting on all endpoints |

---

## 10. Architecture Principles

- **Single source of truth for provenance** — every segment reports source type, age, and confidence; no silent fallbacks.
- **Additive contracts** — new payload fields are never breaking; removals require a version bump.
- **Provider-layer isolation** — `src` never imports from `server`; API is the only bridge.
- **Zero required keys** — the dashboard must work, with degraded labels, even if all providers fail.
- **Cache at the right layer** — in-memory (request-level), Upstash (cross-instance), CDN (`s-maxage`).

---

## 11. Recommended Milestone Order

```
Now (P0)
├── Provision Upstash Redis in Vercel dashboard
└── Wire external degradedSegments alert

Next sprint (P1)
├── Tab-visibility polling pause
├── Documented share-count review cadence
└── Private valuation config extraction

Q3 (P2)
├── E2E degraded-state + Portfolio Lab tests
├── Category search
├── Sort direction fix
└── Framer Motion audit

Q4 (P3)
├── In-card sparklines
├── Cross-device pin sync
└── PWA manifest
```

---

## 12. Current Verification Status (2026-05-29)

| Check | Status |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run typecheck` | ✅ Passed |
| `npm run test` | ✅ Passed (78 tests) |
| `npm run test:routes` | ✅ Passed (33 tests) |
| `npm run build` | ✅ Passed |
| `npm run audit:data` | ✅ Passed |
| `npm run check:bundle` | ✅ Passed (70.6 KB gzip / 420 KB budget) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Upstash Redis (production) | ❌ Not provisioned |
| External degraded alert | ❌ Not configured |
| Fallback snapshot current | ❌ Run `workflow_dispatch` once prod confirmed clean |

---

## 13. Next Agent: Immediate Actions

### Manual (cannot be automated)
1. Vercel Dashboard → Integrations → Upstash KV → bind to `world-asset-prices` production
2. Verify: `vercel env ls --environment=production | grep KV`
3. Trigger `refresh-fallback.yml` via `workflow_dispatch` once `degradedSegments` is empty in production

### Code tasks (in order)
1. Add `visibilitychange` polling pause to `src/hooks/useDashboardData.ts`
2. Add E2E test for degraded-segment banner
3. Add Portfolio Lab E2E smoke coverage
4. Wire external alert for production `degradedSegments`
5. Document quarterly share-count and private-valuation review cadence

### Commands before any logic change
```sh
git status --short
npm run lint && npm run test && npm run test:routes && npm run audit:data
```

### Commands after any code edit
```sh
npm run typecheck && npm run build && npm run check:bundle
npm audit --omit=dev
```

### Stop and ask for human review when touching
- `/api/dashboard` or `/api/asset-detail` payload fields
- `segmentMeta`, `degradedSegments`, or fallback selection logic
- Security headers, rate limiting, or proxy validation
- Provider order or fallback chain structure

# World Asset Prices Roadmap

Last updated: 2026-05-26

## 1) Project summary
A no-key, full-stack market dashboard that serves ranked public assets, private-company valuations, ETFs, FX, crypto, and a local portfolio lab behind a resilient `/api/dashboard` + `/api/asset-detail` contract. The current implementation is production-stable for static and live hosts, but it depends on volatile free providers and curated snapshots for some assets. The roadmap below is execution-ready for the next agent, without changing production logic or UI foundations.

## 2) Current product vision
Track globally relevant assets with clear freshness/provenance signals, keep local-only portfolio workflows fast and private, and keep the experience robust when providers fail.

## 3) Target users
- Students/projects recruiters evaluating engineering quality and architecture.
- Early market-ops / finance learners wanting a live multi-asset snapshot.
- Frontend users who value fast local state and transparent data confidence.
- Contributors extending public-data pipelines and observability.

## 4) What is already finished
- Public/live segments with resilient cache + durable fallback behavior.
- Per-segment stale/degraded labels (`live`, `fresh-cache`, `stale-cache`, `durable-cache`, `fallback`).
- Asset detail provenance for all card types, including source type, confidence, method, and limitation context.
- Portfolio Lab with tradable asset filtering and local persistence.
- GitHub Pages static mirror path for dashboard and detail JSON when backend is unavailable.
- Data quality audit script, production verification script, static smoke coverage, and release gates in CI.

## 5) What is unfinished / unfinished-looking
- No explicit provider redundancy matrix for public equities beyond Stooq + Yahoo fallback.
- No formal accessibility test suite (A11y checks are manual today).
- No explicit public metrics/observability alerts for data drift or stale-source thresholds.
- No contributor docs for routine data maintenance (who updates manifest values and review cadence).
- SEO/social consistency is mostly manual and not fully codified.

## 6) What appears risky
- Provider continuity risk: if Stooq/Yahoo quote paths become intermittently unavailable, ranking freshness relies heavily on cached/snapshot data.
- Historical coverage risk: robust history exists only for stocks/ETFs.
- UX consistency risk: dark/light / mobile smoke is good but no accessibility-specific assertions.
- Data governance risk: snapshot and source files can drift without explicit owner/process.

## 7) What hurts maintainability
- Multiple contracts span `server/types.ts`, `server/dashboard-schema.ts`, and JSON fixtures; adding fields still requires synchronized updates.
- Several scripts perform high-impact data actions (`refresh-fallback.mjs`, `audit-data.mjs`) without a contributor playbook.
- Roadmap information was duplicated between `README.md` and `ROADMAP.md`.

## 8) What hurts user experience
- Users can see valid-looking values but not always enough evidence why a value is scaled/curated at the card level.
- Error and degraded states are visible, but recovery/last-refresh guidance is not centralized in one section.

## 9) What hurts recruiter / GitHub presentation
- `ROADMAP.md` previously mixed shipped/unfinished items without priority labels.
- No central “current status + next milestones” snapshot with acceptance criteria.
- No explicit “what not to touch” guidance for contributors.

## 10) What should be protected and not broken
- Public API contracts for `/api/dashboard` and `/api/asset-detail`.
- Segment-level source states and fallback semantics.
- Local storage keys: `wap.portfolio.v1`, `wap.pinned-markets.v1`, `wap.prefs.v1`.
- No-key and static deployment assumptions (GitHub Pages behavior).
- Security guardrails (`server/client-key.ts`, `server/security.ts`, `api/*` request validation).

## 11) Current verification status
- `npm run lint`: passed.
- `npm run test`: passed (`20` files, `78` tests).
- `npm run test:routes`: passed (`6` files, `33` tests).
- `npm run build`: passed.
- `npm run audit:data`: passed.
- `npm run check:bundle`: passed.
- `npm audit --omit=dev`: found `0` vulnerabilities.
- Failure state: none observed on verification run.

## 12) Highest-priority fixes

### [P1] Document provider continuity and fallback ownership
- What: add contributor-facing ownership + ownership cadence for provider fallback behavior in `README.md` and `ROADMAP.md`.
- Why: current resilience is strong technically but weak operationally for future maintainers.
- Impact: reduces risk of accidental stale deployments and improves runbook clarity.
- Difficulty: Low.
- Risk: Low (documentation only, no logic changes).
- Dependencies: none (docs only).
- Files: `README.md`, `ROADMAP.md`.
- Order: now.
- Acceptance criteria:
  - Repo contains a clear “what happens when live provider fails” flow.
  - Contributor can identify who updates fallback data.
- Tests/checks: run `npm run lint`, `npm run test`, `npm run build` to confirm docs change is non-breaking.

### [P1] Add explicit “readiness-by-feature” matrix
- What: add a new section describing feature-state for each area (Dashboard data, history, static mode, portfolio, CI).
- Why: avoids confusion between “implemented but degraded” and “not implemented”.
- Impact: clearer handoff quality for external reviewers.
- Difficulty: Low.
- Risk: Low.
- Dependencies: none.
- Files: `ROADMAP.md`.
- Order: before any code planning.
- Acceptance criteria:
  - Matrix includes `implemented`, `degraded`, `not implemented`, `blocked` columns.
- Tests/checks: none required; quick manual review.

### [P1] Clarify mobile and accessibility UX expectations
- What: document explicit mobile/tap-focus requirements and announce planned accessibility milestones.
- Why: current UX passes smoke usage but lacks formal checklist for a11y.
- Impact: lowers launch risk and gives QA a concrete acceptance target.
- Difficulty: Low.
- Risk: Low.
- Dependencies: none.
- Files: `ROADMAP.md`, optionally `README.md`.
- Order: next in docs pass.
- Acceptance criteria:
  - Roadmap includes WCAG 2.2 AA target for labels, headings, contrast, focus order.
- Tests/checks: plan includes `npm run test:e2e` + manual keyboard focus run.

## 13) Architecture recommendations
- Enforce a single source-of-truth table for data provenance and snapshot assumptions.
- Add explicit section-level dependency map: which providers feed each segment and what fallback applies.
- Keep provider contracts additive and avoid hidden behavior changes in API consumers.
- Preserve current `api` and `src` split to avoid cross-layer coupling.

## 14) Refactor recommendations
- Collapse duplicate roadmap and status language into one canonical section.
- Move large planning notes from `README` into `ROADMAP.md` and keep README user-facing.
- Reduce drift in docs by referencing command outputs and script names from one section.
- Do not change runtime logic until after data/feature work is planned and approved.

## 15) UI and UX recommendations
- Add a dedicated “Data Health” interpretation panel in docs for user-facing copy and support responses.
- Document expected card behaviors under degraded/fallback states in one discoverable place.
- Keep chart availability text consistent between live and static modes.

## 16) Performance recommendations
- Keep current chunking strategy; add docs for bundle-size baseline.
- For each segment, track provider latency in docs as known baseline (not code).
- Preserve existing lightweight polling and avoid introducing frequent re-fetch loops.

## 17) Security recommendations
- Keep current header policies and no-change to `/api/client-error` logging model unless new requirements appear.
- Add operational guidance for token/secret handling and rotate env var conventions in `SECURITY.md`.
- Include an explicit checklist for `TRUST_PROXY_HEADERS` and Vercel-only assumptions.

## 18) Accessibility recommendations
- Add roadmap task for keyboard-first navigation and dialog focus behavior.
- Add section on icon-only controls with explicit text alternatives.
- Add an a11y smoke item in CI for Playwright: keyboard tab loop + dialog open/close + labels.
- Add color-contrast and motion-reduction checks to the manual UX pass.

## 19) SEO recommendations
- Keep `/docs` screenshot references and `public/site-preview.jpg` in sync.
- Add explicit social meta verification command (`curl`) and expected content checks.
- Avoid aggressive DOM changes that reduce heading hierarchy in section nav.

## 20) Testing strategy
- Unit + route: unchanged commands.
- E2E: continue smoke coverage for live and static.
- Contract: confirm dashboard payload shape and detail payload shape remain additive.
- Data governance: continue `npm run audit:data` with manifest drift checks.
- Production checks: continue scheduled verifier plus manual review on each milestone completion.

## 21) CI/CD and deployment recommendations
- Keep CI quality job as source of truth for local gating.
- Add explicit roadmap task to include dependency-review output in release notes.
- Keep GitHub Pages build command pinned to static-only mode and static smoke after deploy.
- Keep scheduled production verifier unchanged unless schema changes.

## 22) Documentation improvements
- Add a short “Current limitations” block in `README.md` with severity labels.
- Link `ROADMAP.md`, `CHANGELOG.md`, `security_best_practices_report.md` directly from README.
- Add release status section with last verification command run and timestamp.
- Add explicit “Planned, not yet implemented” label style.

## 23) GitHub presentation improvements
- Improve landing copy in README first paragraph and add one-line status.
- Keep badges current and remove stale claims.
- Include short “Portfolio/Engineering Highlights” section with links to tests and reports.
- Ensure screenshot path is valid in both hosted and local contexts.

## 24) Recruiter and portfolio polish
- Add “Execution notes” section that names tradeoffs made for MVP.
- Include a compact architecture diagram reference path (no inline generated diagram required).
- Add “What to run to verify” in README with current command outputs.
- Keep codebase boundaries clear (`app logic` vs `scripts` vs `tests`).

## 25) Future feature ideas (non-blocking)
- Optional cross-device profile sync for watchlist and portfolio.
- Optional scenario analysis for holdings.
- Optional SSE/polling optimization for future real-time updates.

## 26) Production readiness checklist
- [ ] No unresolved verification failures in `npm run lint`, `npm run test`, `npm run test:routes`, `npm run build`, `npm run check:bundle`, `npm run audit:data`.
- [ ] Static deployment smoke covers no `/api/*` calls and can open stock/private detail.
- [ ] Data manifest and fallback files include source URLs + date fields.
- [ ] Top-segment ordering remains correct when stale/fallback path is active.
- [ ] README + ROADMAP remain in sync with current behavior.

## 27) Recommended milestone order
1. Documentation alignment (current status + risk matrix).
2. Governance hardening (who updates what, when).
3. Accessibility and QA checks in roadmap/CI narrative.
4. SEO/social consistency and release-note hygiene.
5. Feature expansion only after above baseline is signed.

## 28) Roadmap item detail

### [P1] Add roadmap governance sections to README
- What: add `Project status`, `Roadmap`, `Verification status`, and `What next` sections.
- Why: reduces support debt and recruiter confusion.
- Expected impact: faster onboarding and cleaner handoffs.
- Difficulty: Low.
- Risk: Low.
- Dependencies: none.
- Files: `README.md`.
- Order: first.
- Acceptance criteria:
  - README has a clear project status line and link to `ROADMAP.md`.
  - No stale links.
- Checks: `npm run lint`.

### [P1] Split roadmap into “finished / in flight / planned” buckets with explicit owners
- What: convert roadmap into buckets plus explicit priorities.
- Why: allows fast planning for new contributors.
- Expected impact: reduces ambiguity and duplicated work.
- Difficulty: Low.
- Risk: Low.
- Dependencies: none.
- Files: `ROADMAP.md`.
- Order: immediate.
- Acceptance criteria:
  - Three buckets are present and each item states status.
- Checks: manual review.

### [P1] Add acceptance criteria to all active milestones
- What: each listed milestone includes acceptance criteria and command check list.
- Why: ensures reproducible completion, not just subjective progress.
- Expected impact: smoother reviews and lower break risk.
- Difficulty: Low.
- Risk: Low.
- Dependencies: `ROADMAP.md`.
- Order: immediate.
- Acceptance criteria:
  - All active milestones include all required fields.
- Checks: manual review.

### [P2] Record data and UI maintenance workflow
- What: add contributor playbook for manifest updates and fallback refresh reviews.
- Why: snapshot values and source files are high-sensitivity data.
- Expected impact: reduces stale baseline risk.
- Difficulty: Medium.
- Risk: Low.
- Dependencies: `docs` + `scripts`.
- Files: `ROADMAP.md`, `CONTRIBUTING.md`, `scripts/refresh-fallback.mjs`.
- Order: after core roadmap doc cleanup.
- Acceptance criteria:
  - The workflow identifies cadence, review owner, and failure fallback.
- Checks: manual audit + `npm run audit:data`.

### [P2] Add a “degradation map” page in docs
- What: one document mapping each segment to data source, freshness expectation, and degraded behavior.
- Why: hard to reason about runtime behavior without consolidated reference.
- Expected impact: fewer support and debugging questions.
- Difficulty: Medium.
- Risk: Low.
- Dependencies: `server` contracts.
- Files: `ROADMAP.md`, `README.md`.
- Order: early.
- Acceptance criteria:
  - Each segment links to at least one source and one fallback route.
- Checks: docs review + `npm run verify:production`.

### [P3] Formalize accessibility and SEO audit tasks in a release cadence
- What: include specific checks in “Next milestones” and track completion.
- Why: these are currently weakly enforced.
- Expected impact: stronger release confidence.
- Difficulty: Medium.
- Risk: Low.
- Dependencies: none.
- Files: `ROADMAP.md`.
- Order: before next UI change release.
- Acceptance criteria:
  - A11y and SEO tasks are assigned before launch tasks.
- Checks: manual keyboard + screenshot review + `npm run test:e2e`.

## 29) Next Agent Instructions

### First 5 tasks
1. Reconcile this roadmap structure with `README.md` by adding the new `Project status` and `Verification status` sections.
2. Add a section in README linking this roadmap and the latest audit reports.
3. Verify all command references in docs are accurate (`npm run audit:data`, `npm run build`, etc.).
4. Confirm all doc-internal links resolve, especially `ROADMAP.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md`.
5. Run the required verification command set listed below and record results in `ROADMAP.md`.

### Commands before making logic changes
- `git status --short`
- `npm run lint`
- `npm run test`
- `npm run test:routes`
- `npm run audit:data`

### Commands after documentation edits
- `npm run check:bundle`
- `npm run build`
- `npm audit --omit=dev`

### Verification checks for the next agent
- Confirm no app logic files changed in this documentation cycle.
- Confirm all README/ROADMAP links resolve on GitHub and local checkout.
- Confirm next planned task includes status + acceptance criteria + dependency notes.
- Run any two release checks (`npm run test:e2e`, `npm run verify:production`) before starting feature work.

### What not to break
- `/api/dashboard` and `/api/asset-detail` payload fields.
- Static deployment behavior (`GITHUB_PAGES` paths and fallback JSON generation).
- Segment source labels and health state semantics.
- Local storage keys used by preferences, watchlist, and portfolio.

### When to stop and ask for human review
- Any change that touches `/api/dashboard`, `/api/asset-detail`, or provider endpoints.
- Any change that modifies `segmentMeta`, `degradedSegments`, or fallback selection logic.
- Any security headers, rate-limiting, or proxy validation changes.

### Recommended first commit message
`docs: add execution roadmap for next agent`

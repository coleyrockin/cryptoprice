# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- CI workflow now enforces lint, typecheck, unit/integration tests, route tests, build, bundle budget, and E2E smoke checks.
- `npm run check` now runs the complete local validation gate sequence.
- README and contributing docs updated to reflect current architecture, contracts, and quality standards.
- Package metadata and keywords updated for clearer professional positioning.

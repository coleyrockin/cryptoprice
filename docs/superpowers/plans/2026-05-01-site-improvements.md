# Site Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dashboard discovery controls, pinned watchlist, hero insights, and responsive polish.

**Architecture:** Keep the API payload untouched. Add pure client helpers for insight/filter/sort behavior, then wire those helpers into `App.tsx` and style the new surfaces in `globals.css`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS/Tailwind entry file.

---

### Task 1: Client Insight Helpers

**Files:**
- Create: `src/lib/dashboard-insights.ts`
- Create: `src/lib/dashboard-insights.test.ts`

- [ ] Write tests for text matching, entry sorting, and dashboard summary generation.
- [ ] Implement pure helper functions with no React dependencies.
- [ ] Run helper tests.

### Task 2: App Controls and Watchlist

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] Add tests for search filtering and pinned watchlist rendering.
- [ ] Add control state: search, section filter, sort mode, density, pinned IDs.
- [ ] Render hero insight rail, control bar, and watchlist section.
- [ ] Pass pin handlers through existing `MarketCard` props.
- [ ] Run App tests.

### Task 3: Responsive Styling

**Files:**
- Modify: `src/globals.css`

- [ ] Style insight rail, controls, watchlist, compact mode, and filter empty states.
- [ ] Tighten responsive wrapping for controls, nav, and cards.
- [ ] Run lint, typecheck, and build.

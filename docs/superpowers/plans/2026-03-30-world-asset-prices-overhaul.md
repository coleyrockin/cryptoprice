# World Asset Prices Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the CSS to Tailwind v4 with class-based dark/light mode toggle, add a "last updated" timestamp to the status bar, fix package.json branding, and rewrite the README — leaving all server/API/test logic untouched.

**Architecture:** Tailwind v4 is installed via `@tailwindcss/vite` plugin. `src/styles.css` is replaced by `src/globals.css` which imports Tailwind and re-declares all existing custom CSS inside `@layer components`, with a `@variant dark` directive enabling `.dark`-prefixed Tailwind utilities. A `useTheme` hook manages the `dark` class on `<html>`, using `localStorage` and `prefers-color-scheme` for the initial value. CSS custom properties are defined for both themes inside `:root` (dark-first) and `html:not(.dark)` (light overrides).

**Tech Stack:** Tailwind CSS v4, `@tailwindcss/vite`, existing React 19 / TypeScript / Vite 7 stack.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/globals.css` | Tailwind entry + all visual CSS (replaces `src/styles.css`) |
| Delete | `src/styles.css` | Replaced by globals.css |
| Create | `src/hooks/useTheme.ts` | Dark/light mode state, localStorage, prefers-color-scheme |
| Modify | `src/main.tsx` | Import `globals.css` instead of `styles.css` |
| Modify | `vite.config.ts` | Add `@tailwindcss/vite` plugin |
| Modify | `src/App.tsx` | Theme toggle button in header; "last updated" in status bar; `dark:` classes on light-sensitive elements |
| Modify | `src/components/MarketCard.tsx` | `dark:` classes for light-mode card backgrounds |
| Modify | `src/components/SectionHeader.tsx` | `dark:` classes for light-mode heading color |
| Modify | `src/components/LogoMark.tsx` | `dark:` classes for monogram fallback background |
| Modify | `package.json` | Fix `name`, `description`, `author` fields |
| Modify | `README.md` | Full rewrite with World Asset Prices branding |

---

## Task 1: Install Tailwind v4

**Files:**
- Modify: `package.json` (deps only — a later task handles branding fields)
- Modify: `vite.config.ts`

- [ ] **Step 1.1: Install packages**

```bash
cd /Users/boydroberts/Documents/projects/world-asset-prices
npm install tailwindcss @tailwindcss/vite
```

Expected: resolves without error, `tailwindcss` and `@tailwindcss/vite` appear in `package.json` dependencies.

- [ ] **Step 1.2: Add Tailwind plugin to vite.config.ts**

Open `vite.config.ts`. The current top of the file is:
```ts
import { copyFileSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
```

Replace those import lines with:
```ts
import { copyFileSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
```

Then find the `plugins` array:
```ts
  plugins: [react(), localApiPlugin(), githubPagesFallbackPlugin()],
```

Replace it with:
```ts
  plugins: [tailwindcss(), react(), localApiPlugin(), githubPagesFallbackPlugin()],
```

- [ ] **Step 1.3: Verify TypeScript is happy**

```bash
npm run typecheck
```

Expected: passes (or shows only pre-existing errors unrelated to Tailwind).

- [ ] **Step 1.4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "feat: install tailwindcss v4 and @tailwindcss/vite plugin"
```

---

## Task 2: Create globals.css (Tailwind entry + migrated CSS)

This task replaces `src/styles.css` with `src/globals.css`. The new file:
1. Imports Tailwind
2. Declares the dark-mode `@variant`
3. Defines CSS custom properties for dark (default) and light themes
4. Re-declares all existing custom CSS inside `@layer components`

**Files:**
- Create: `src/globals.css`
- Delete (in a later task): `src/styles.css`

- [ ] **Step 2.1: Create src/globals.css**

Create the file at `src/globals.css` with exactly this content:

```css
@import "tailwindcss";
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Sora:wght@500;700;800&display=swap");

/* Class-based dark mode: add/remove .dark on <html> */
@variant dark (&:where(.dark, .dark *));

/* ── Theme tokens ── */
/* Dark theme is the default (dark-first) */
:root {
  color-scheme: dark;
  --bg: #000;
  --bg-soft: #070709;
  --surface-border: rgba(255, 255, 255, 0.12);
  --surface-border-strong: rgba(255, 255, 255, 0.28);
  --text: #f3f3f3;
  --text-dim: #c2c2c7;
  --text-muted: #ababaf;
  --green: #50ffb0;
  --red: #ff6b8a;
  --flat: #c8c8cf;
  --hover-blue: 100, 180, 255;
  --hover-green: 80, 255, 200;
  --hover-pink: 255, 120, 220;
  --accent-blue: #60b8ffdd;
  --accent-purple: #b89cff;
  --accent-cyan: #4df0e0;
  --glow-blue: rgba(100, 180, 255, 0.2);
  --glow-purple: rgba(184, 156, 255, 0.16);
  --glow-pink: rgba(255, 120, 220, 0.14);
  --orb-opacity: 1;
  --surface-bg: linear-gradient(160deg, rgba(12, 12, 18, 0.95), rgba(4, 4, 8, 0.98));
  --surface-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(100, 180, 255, 0.04), 0 8px 40px rgba(0, 0, 0, 0.35), 0 0 60px rgba(100, 180, 255, 0.03);
  --nav-bg: rgba(4, 4, 10, 0.75);
  --input-bg: rgba(8, 8, 12, 0.8);
  --card-bg: linear-gradient(160deg, rgba(14, 14, 22, 0.92), rgba(8, 8, 14, 0.96)) padding-box, linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(100, 180, 255, 0.08), rgba(184, 156, 255, 0.06)) border-box;
  --logo-fallback-bg: rgba(255, 255, 255, 0.1);
  --logo-fallback-color: #c8c8cf;
  --monogram-border: rgba(255, 255, 255, 0.18);
}

/* Light theme overrides */
html:not(.dark) {
  color-scheme: light;
  --bg: #f1f5f9;
  --bg-soft: #e2e8f0;
  --surface-border: rgba(0, 0, 0, 0.1);
  --surface-border-strong: rgba(0, 0, 0, 0.2);
  --text: #0f172a;
  --text-dim: #334155;
  --text-muted: #64748b;
  --green: #059669;
  --red: #e11d48;
  --flat: #64748b;
  --hover-blue: 37, 99, 235;
  --hover-green: 5, 150, 105;
  --hover-pink: 219, 39, 119;
  --accent-blue: #2563eb;
  --accent-purple: #7c3aed;
  --accent-cyan: #0891b2;
  --glow-blue: rgba(37, 99, 235, 0.12);
  --glow-purple: rgba(124, 58, 237, 0.1);
  --glow-pink: rgba(219, 39, 119, 0.08);
  --orb-opacity: 0.35;
  --surface-bg: linear-gradient(160deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
  --surface-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(37, 99, 235, 0.06), 0 8px 40px rgba(0, 0, 0, 0.08), 0 0 60px rgba(37, 99, 235, 0.02);
  --nav-bg: rgba(255, 255, 255, 0.85);
  --input-bg: rgba(248, 250, 252, 0.9);
  --card-bg: linear-gradient(160deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98)) padding-box, linear-gradient(160deg, rgba(0, 0, 0, 0.08), rgba(37, 99, 235, 0.06), rgba(124, 58, 237, 0.04)) border-box;
  --logo-fallback-bg: rgba(0, 0, 0, 0.06);
  --logo-fallback-color: #475569;
  --monogram-border: rgba(0, 0, 0, 0.12);
}

/* ── Base reset ── */
* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  min-height: 100%;
  background: var(--bg);
}

body {
  font-family: "Space Grotesk", sans-serif;
  color: var(--text);
  background:
    radial-gradient(ellipse 80% 50% at 12% -8%, rgba(100, 180, 255, 0.14), transparent),
    radial-gradient(ellipse 70% 40% at 88% -4%, rgba(184, 156, 255, 0.1), transparent),
    radial-gradient(ellipse 50% 50% at 50% 100%, rgba(100, 180, 255, 0.06), transparent),
    linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
  background-attachment: fixed;
  transition: background-color 250ms ease, color 250ms ease;
}

html:not(.dark) body {
  background:
    radial-gradient(ellipse 80% 50% at 12% -8%, rgba(37, 99, 235, 0.06), transparent),
    radial-gradient(ellipse 70% 40% at 88% -4%, rgba(124, 58, 237, 0.05), transparent),
    radial-gradient(ellipse 50% 50% at 50% 100%, rgba(37, 99, 235, 0.03), transparent),
    linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
}

h1, h2, h3 {
  margin: 0;
  font-family: "Sora", sans-serif;
}

/* ── Background Orbs ── */
.bg-orbs {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  opacity: var(--orb-opacity);
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  will-change: transform;
}

.bg-orb-1 {
  width: 900px; height: 900px;
  background: radial-gradient(circle, rgba(92, 170, 255, 0.35) 0%, rgba(92, 170, 255, 0.08) 60%, transparent 80%);
  top: -15%; left: -12%;
  animation: drift-1 22s ease-in-out infinite alternate;
}

.bg-orb-2 {
  width: 750px; height: 750px;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.3) 0%, rgba(167, 139, 250, 0.06) 60%, transparent 80%);
  top: 25%; right: -15%;
  animation: drift-2 18s ease-in-out infinite alternate;
}

.bg-orb-3 {
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(238, 149, 205, 0.22) 0%, rgba(238, 149, 205, 0.05) 60%, transparent 80%);
  bottom: -10%; left: 15%;
  animation: drift-3 25s ease-in-out infinite alternate;
}

@keyframes drift-1 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(120px, 100px) scale(1.15); }
}
@keyframes drift-2 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(-100px, 120px) scale(1.1); }
}
@keyframes drift-3 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(80px, -70px) scale(1.12); }
}

/* ── Shell ── */
.shell {
  width: min(1200px, 95vw);
  margin: 1.8rem auto 3.6rem;
  display: grid;
  gap: 1.4rem;
}

/* ── Section Nav ── */
.section-nav {
  position: sticky;
  top: 0.65rem;
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  gap: 0.44rem;
  padding: 0.48rem;
  border: 1px solid rgba(100, 180, 255, 0.12);
  border-radius: 14px;
  background: var(--nav-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 40px rgba(100, 180, 255, 0.04);
}

html:not(.dark) .section-nav {
  border-color: rgba(37, 99, 235, 0.15);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 40px rgba(37, 99, 235, 0.03);
}

.section-nav a {
  text-decoration: none;
  color: var(--text-muted);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 0.34rem 0.72rem;
  font-size: 0.76rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  transition: all 200ms ease;
}

html:not(.dark) .section-nav a {
  border-color: rgba(0, 0, 0, 0.1);
}

.section-nav a:hover, .section-nav a:focus-visible {
  color: var(--text);
  border-color: rgba(140, 180, 255, 0.5);
  background: rgba(92, 170, 255, 0.1);
  box-shadow: 0 0 12px rgba(92, 170, 255, 0.12);
  outline: none;
}

.section-nav a.nav-active {
  color: var(--text);
  border-color: rgba(100, 180, 255, 0.6);
  background: rgba(100, 180, 255, 0.18);
  box-shadow: 0 0 20px rgba(100, 180, 255, 0.25), inset 0 0 12px rgba(100, 180, 255, 0.08);
}

html:not(.dark) .section-nav a.nav-active {
  color: #1e40af;
  border-color: rgba(37, 99, 235, 0.5);
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 0 20px rgba(37, 99, 235, 0.12), inset 0 0 12px rgba(37, 99, 235, 0.04);
}

/* ── Surfaces ── */
.hero, .surface {
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  background: var(--surface-bg);
  box-shadow: var(--surface-shadow);
  transition: background 250ms ease, box-shadow 250ms ease, border-color 250ms ease;
}

.hero {
  padding: 1.6rem 1.6rem 1.4rem;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: "";
  position: absolute;
  top: -60%; left: -20%;
  width: 70%; height: 200%;
  background: radial-gradient(ellipse, rgba(100, 180, 255, 0.12), transparent 70%);
  pointer-events: none;
}

.hero::after {
  content: "";
  position: absolute;
  top: -40%; right: -10%;
  width: 50%; height: 180%;
  background: radial-gradient(ellipse, rgba(184, 156, 255, 0.1), transparent 70%);
  pointer-events: none;
}

html:not(.dark) .hero::before {
  background: radial-gradient(ellipse, rgba(37, 99, 235, 0.06), transparent 70%);
}

html:not(.dark) .hero::after {
  background: radial-gradient(ellipse, rgba(124, 58, 237, 0.05), transparent 70%);
}

.surface { padding: 1.1rem; }

/* ── Hero Text ── */
.eyebrow {
  position: relative;
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-blue);
  font-weight: 500;
}

.hero-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

h1 {
  margin-top: 0.5rem;
  font-size: clamp(1.7rem, 5vw, 3.2rem);
  line-height: 1.04;
  font-weight: 800;
  background: linear-gradient(135deg, #fff 0%, #80d0ff 30%, #b89cff 55%, #ff78dc 80%, #ffb86c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  position: relative;
  filter: drop-shadow(0 0 40px rgba(100, 180, 255, 0.15));
}

html:not(.dark) h1 {
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #7c3aed 70%, #db2777 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: none;
}

h1 span {
  background: linear-gradient(135deg, #a0b4d0 0%, #8899b4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

html:not(.dark) h1 span {
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  margin: 0.64rem 0 0;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

/* ── Theme Toggle Button ── */
.theme-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  background: var(--logo-fallback-bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 200ms ease;
  position: relative;
  z-index: 1;
}

.theme-toggle:hover {
  color: var(--text);
  border-color: var(--accent-blue);
  background: rgba(100, 180, 255, 0.1);
}

html:not(.dark) .theme-toggle:hover {
  background: rgba(37, 99, 235, 0.08);
}

.theme-toggle svg {
  width: 1rem;
  height: 1rem;
}

/* ── Status Badge ── */
.status {
  margin-top: 1rem;
  width: fit-content;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.36rem 0.72rem;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status::before {
  content: "";
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-refresh { color: var(--text-muted); font-weight: 400; }
.status-updated { color: var(--text-muted); font-weight: 400; }

.status.live {
  border-color: rgba(110, 245, 181, 0.3);
  background: rgba(110, 245, 181, 0.08);
  color: #a8ffd6;
}

.status.live::before {
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-dot 2s ease-in-out infinite;
}

html:not(.dark) .status.live {
  border-color: rgba(5, 150, 105, 0.3);
  background: rgba(5, 150, 105, 0.08);
  color: #065f46;
}

html:not(.dark) .status.live::before {
  box-shadow: 0 0 8px var(--green);
}

.status.loading {
  border-color: rgba(146, 170, 255, 0.35);
  background: rgba(146, 170, 255, 0.08);
  color: #c8d6ff;
}

.status.loading::before {
  background: #92aaff;
  animation: pulse-dot 1.2s ease-in-out infinite;
}

html:not(.dark) .status.loading {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.06);
  color: #1e40af;
}

html:not(.dark) .status.loading::before {
  background: #2563eb;
}

.status.error {
  border-color: rgba(255, 143, 163, 0.35);
  background: rgba(255, 143, 163, 0.08);
  color: #ffc0cc;
}

.status.error::before {
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
}

html:not(.dark) .status.error {
  border-color: rgba(225, 29, 72, 0.3);
  background: rgba(225, 29, 72, 0.06);
  color: #9f1239;
}

.status.stale {
  border-color: rgba(255, 195, 110, 0.35);
  background: rgba(255, 195, 110, 0.08);
  color: #ffdda8;
}

.status.stale::before { background: #ffc36e; }

html:not(.dark) .status.stale {
  border-color: rgba(217, 119, 6, 0.3);
  background: rgba(217, 119, 6, 0.06);
  color: #92400e;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

/* ── Controls ── */
.controls-surface { border-color: rgba(92, 170, 255, 0.18); }

html:not(.dark) .controls-surface { border-color: rgba(37, 99, 235, 0.15); }

.controls-grid {
  margin-top: 0.82rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.62rem;
}

.control {
  display: grid;
  gap: 0.38rem;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.control > span {
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 500;
  font-size: 0.7rem;
}

.control input[type="search"],
.control select {
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--text);
  font: inherit;
  padding: 0.5rem 0.62rem;
  transition: all 200ms ease;
}

.control input[type="search"]:focus-visible,
.control select:focus-visible {
  outline: none;
  border-color: rgba(92, 170, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(92, 170, 255, 0.12), 0 0 16px rgba(92, 170, 255, 0.08);
  background: var(--input-bg);
}

html:not(.dark) .control input[type="search"]:focus-visible,
html:not(.dark) .control select:focus-visible {
  border-color: rgba(37, 99, 235, 0.5);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1), 0 0 16px rgba(37, 99, 235, 0.06);
}

.control-checkbox {
  display: flex;
  align-items: center;
  gap: 0.52rem;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 0.52rem;
  align-self: end;
  background: var(--input-bg);
  transition: all 200ms ease;
}

.control-checkbox:hover { border-color: var(--surface-border-strong); }

.control-checkbox input { accent-color: #6eb4ff; }

html:not(.dark) .control-checkbox input { accent-color: #2563eb; }

.controls-actions {
  margin-top: 0.72rem;
  display: flex;
  gap: 0.46rem;
}

.controls-actions button {
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: var(--logo-fallback-bg);
  color: var(--text-dim);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.36rem 0.78rem;
  cursor: pointer;
  transition: all 200ms ease;
}

.controls-actions button:hover:not(:disabled),
.controls-actions button:focus-visible:not(:disabled) {
  color: var(--text);
  border-color: rgba(140, 180, 255, 0.5);
  background: rgba(92, 170, 255, 0.1);
  box-shadow: 0 0 12px rgba(92, 170, 255, 0.08);
  outline: none;
}

html:not(.dark) .controls-actions button:hover:not(:disabled),
html:not(.dark) .controls-actions button:focus-visible:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.06);
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.06);
}

.controls-actions button:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Section Headers ── */
.surface-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.surface-title-row {
  display: flex;
  align-items: center;
  gap: 0.52rem;
  min-width: 0;
}

.surface-title-accent {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
}

.surface-head h2 {
  font-size: clamp(1rem, 2vw, 1.32rem);
  font-weight: 700;
  letter-spacing: 0.03em;
  background: linear-gradient(135deg, #fff 10%, #80d0ff 50%, #b89cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

html:not(.dark) .surface-head h2 {
  background: linear-gradient(135deg, #0f172a 10%, #1d4ed8 55%, #7c3aed 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.surface-head p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* ── Card Grid ── */
.coin-grid {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.68rem;
}

/* ── Cards ── */
.coin-card {
  --hover-opacity: 0.28;
  --hover-border: rgba(140, 190, 255, 0.8);
  --hover-shadow:
    0 20px 50px rgba(0, 0, 0, 0.6),
    0 0 50px rgba(100, 180, 255, 0.2),
    0 0 100px rgba(100, 180, 255, 0.08);
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--card-bg);
  color: var(--text);
  padding: 0.78rem;
  text-align: left;
  cursor: default;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 30px rgba(100, 180, 255, 0.03);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms ease,
    background 320ms ease;
}

html:not(.dark) .coin-card {
  --hover-opacity: 0.08;
  --hover-shadow:
    0 20px 50px rgba(0, 0, 0, 0.12),
    0 0 50px rgba(37, 99, 235, 0.1),
    0 0 100px rgba(37, 99, 235, 0.04);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 30px rgba(37, 99, 235, 0.02);
}

button.coin-card {
  appearance: none;
  width: 100%;
  font: inherit;
}

.interactive-card { cursor: pointer; }

/* Shimmer sweep on hover */
.coin-card::before {
  content: "";
  position: absolute;
  inset: -45%;
  background: linear-gradient(
    112deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.25) 45%,
    rgba(100, 210, 255, 0.15) 50%,
    rgba(184, 156, 255, 0.1) 55%,
    rgba(255, 255, 255, 0) 70%
  );
  transform: translateX(-120%) rotate(14deg);
  transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

html:not(.dark) .coin-card::before {
  background: linear-gradient(
    112deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.6) 45%,
    rgba(37, 99, 235, 0.08) 50%,
    rgba(124, 58, 237, 0.06) 55%,
    rgba(255, 255, 255, 0) 70%
  );
}

/* Gradient overlay on hover */
.coin-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease;
  border-radius: inherit;
  background:
    radial-gradient(circle at 18% 15%, rgba(var(--hover-blue), 0.3), transparent 55%),
    radial-gradient(circle at 85% 20%, rgba(var(--hover-green), 0.22), transparent 55%),
    radial-gradient(circle at 70% 85%, rgba(var(--hover-pink), 0.2), transparent 50%);
}

/* Keep card content above overlay */
.coin-head, .coin-title-row, .coin-price, .coin-change,
.asset-note, .coin-foot, .card-actions { position: relative; z-index: 1; }

.coin-card:hover, .coin-card:focus-visible {
  transform: translateY(-8px) scale(1.03);
  background:
    linear-gradient(
      138deg,
      rgba(var(--hover-blue), var(--hover-opacity)) 0%,
      rgba(var(--hover-green), calc(var(--hover-opacity) * 0.85)) 45%,
      rgba(var(--hover-pink), calc(var(--hover-opacity) * 0.8)) 100%
    ) padding-box,
    linear-gradient(135deg, rgba(100, 210, 255, 0.6), rgba(184, 156, 255, 0.5), rgba(255, 120, 220, 0.5)) border-box;
  box-shadow: var(--hover-shadow);
}

.coin-card:hover::before, .coin-card:focus-visible::before {
  transform: translateX(118%) rotate(14deg);
}

.coin-card:hover::after, .coin-card:focus-visible::after { opacity: 1; }

.coin-card:focus-visible { outline: none; }

.coin-card.active {
  background:
    linear-gradient(
      145deg,
      rgba(var(--hover-blue), 0.15),
      rgba(var(--hover-green), 0.1) 50%,
      rgba(var(--hover-pink), 0.08)
    ) padding-box,
    linear-gradient(135deg, rgba(100, 210, 255, 0.5), rgba(184, 156, 255, 0.4), rgba(255, 120, 220, 0.4)) border-box;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 40px rgba(100, 180, 255, 0.12),
    0 16px 32px rgba(0, 0, 0, 0.5);
}

.asset-card {
  --hover-opacity: 0.25;
  --hover-border: rgba(165, 210, 255, 0.7);
  --hover-shadow:
    0 22px 50px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(100, 180, 255, 0.12),
    0 0 80px rgba(184, 156, 255, 0.06);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}

/* ── Card Content ── */
.coin-head {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 500;
}

.asset-category {
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.coin-title-row {
  margin-top: 0.42rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.44rem;
}

.coin-title-main {
  display: flex;
  align-items: center;
  gap: 0.52rem;
  min-width: 0;
}

.coin-card h3 {
  font-size: 0.95rem;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Symbol Pill ── */
.symbol-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-dim);
  padding: 0.22rem 0.52rem;
  font-family: "Sora", sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  transition: all 200ms ease;
}

html:not(.dark) .symbol-pill {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
}

.coin-card:hover .symbol-pill,
.coin-card:focus-visible .symbol-pill {
  background: rgba(100, 180, 255, 0.2);
  border-color: rgba(100, 210, 255, 0.5);
}

html:not(.dark) .coin-card:hover .symbol-pill,
html:not(.dark) .coin-card:focus-visible .symbol-pill {
  background: rgba(37, 99, 235, 0.1);
  border-color: rgba(37, 99, 235, 0.4);
}

/* ── Coin Price & Change ── */
.coin-price {
  margin: 0.52rem 0 0;
  font-size: 1.15rem;
  font-weight: 700;
  font-family: "Sora", sans-serif;
  color: var(--text);
  letter-spacing: -0.02em;
}

.coin-change {
  margin: 0.22rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
}

.asset-note {
  margin: 0.22rem 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 400;
}

.is-up { color: var(--green); }
.is-down { color: var(--red); }
.is-flat { color: var(--flat); }
.muted { color: var(--text-muted); font-size: 0.9rem; margin: 0.6rem 0; }

/* ── Logo + Monogram ── */
.asset-logo {
  width: 28px; height: 28px;
  border-radius: 50%;
  object-fit: contain;
  flex-shrink: 0;
}

.logo-fallback {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1px solid var(--monogram-border);
  background: var(--logo-fallback-bg);
  color: var(--logo-fallback-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Sora", sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* ── Card Footer ── */
.coin-foot {
  margin-top: 0.62rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 36px;
}

.card-actions {
  display: flex;
  gap: 0.32rem;
  flex-wrap: wrap;
}

.card-chip {
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: var(--logo-fallback-bg);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.67rem;
  font-weight: 500;
  padding: 0.22rem 0.5rem;
  cursor: pointer;
  transition: all 180ms ease;
  line-height: 1;
}

.card-chip:hover {
  color: var(--text);
  border-color: rgba(100, 200, 255, 0.5);
  background: rgba(100, 180, 255, 0.12);
}

html:not(.dark) .card-chip:hover {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.06);
}

.card-chip.active {
  border-color: rgba(100, 200, 255, 0.6);
  background: rgba(100, 180, 255, 0.2);
  color: #a0d8ff;
}

html:not(.dark) .card-chip.active {
  border-color: rgba(37, 99, 235, 0.5);
  background: rgba(37, 99, 235, 0.1);
  color: #1e40af;
}

/* ── Sparkline ── */
.card-sparkline {
  width: 80px;
  height: 26px;
  flex-shrink: 0;
  display: block;
}

.card-sparkline polyline {
  fill: none;
  stroke: rgba(100, 210, 255, 0.9);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

html:not(.dark) .card-sparkline polyline {
  stroke: rgba(37, 99, 235, 0.8);
}

.sparkline-fill {
  fill: url(#sparkline-gradient);
  stroke: none;
}

/* ── Skeleton ── */
.skeleton-card { pointer-events: none; }

.skeleton-line {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  height: 0.75rem;
  margin-top: 0.6rem;
}

html:not(.dark) .skeleton-line {
  background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.04) 75%);
  background-size: 200% 100%;
}

.skeleton-line-sm { height: 0.55rem; width: 55%; }
.skeleton-line-lg { height: 1.1rem; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Compare ── */
.compare-grid {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.8rem;
}

.compare-card {
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background: var(--surface-bg);
  padding: 0.9rem;
  box-shadow: var(--surface-shadow);
}

.compare-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.7rem;
}

.compare-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.compare-title-group h3 {
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-stat-label {
  margin: 0.6rem 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
}

/* ── NIGHT / Midnight section ── */
.midnight-surface {
  border-color: rgba(100, 180, 255, 0.2);
  background: linear-gradient(160deg, rgba(8, 8, 18, 0.97), rgba(4, 4, 12, 0.99));
}

html:not(.dark) .midnight-surface {
  border-color: rgba(37, 99, 235, 0.15);
  background: var(--surface-bg);
}

.midnight-layout { margin-top: 0.9rem; }

.night-main { max-width: 480px; }

.night-price {
  font-size: clamp(2rem, 6vw, 3.2rem);
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.03em;
  line-height: 1;
  margin-top: 0.3rem;
}

.night-change {
  margin: 0.4rem 0 0;
  font-size: 1rem;
  font-weight: 600;
}

.night-stats {
  margin-top: 1.2rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;
}

.night-stats article {
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  background: var(--logo-fallback-bg);
  padding: 0.7rem 0.8rem;
}

.night-stats article p {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
}

.night-stats article strong {
  display: block;
  margin-top: 0.28rem;
  font-size: 1.05rem;
  font-weight: 700;
  font-family: "Sora", sans-serif;
  color: var(--text);
  letter-spacing: -0.02em;
}

/* ── Disclaimer ── */
.disclaimer {
  margin: 0.6rem 0 0;
  font-size: 0.76rem;
  color: var(--text-muted);
  opacity: 0.7;
}

/* ── Section-specific surface accents ── */
.global-assets-surface { border-color: rgba(100, 210, 255, 0.18); }
.stocks-surface { border-color: rgba(184, 156, 255, 0.18); }
.cryptos-surface { border-color: rgba(100, 180, 255, 0.2); }
.compare-surface { border-color: rgba(80, 255, 200, 0.14); }

html:not(.dark) .global-assets-surface { border-color: rgba(8, 145, 178, 0.2); }
html:not(.dark) .stocks-surface { border-color: rgba(124, 58, 237, 0.15); }
html:not(.dark) .cryptos-surface { border-color: rgba(37, 99, 235, 0.18); }
html:not(.dark) .compare-surface { border-color: rgba(5, 150, 105, 0.15); }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .coin-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .controls-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 768px) {
  .shell { width: 95vw; margin: 1rem auto 2.4rem; }
  .coin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .night-stats { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .coin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .controls-grid { grid-template-columns: 1fr; }
  h1 { font-size: clamp(1.4rem, 7vw, 2rem); }
  .hero { padding: 1.2rem 1rem 1rem; }
  .surface { padding: 0.9rem; }
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/globals.css
git commit -m "feat: create globals.css with Tailwind v4 + dual-theme CSS vars"
```

---

## Task 3: Wire up globals.css, remove styles.css

**Files:**
- Modify: `src/main.tsx`
- Delete: `src/styles.css`

- [ ] **Step 3.1: Update main.tsx CSS import**

In `src/main.tsx`, find:
```ts
import "./styles.css";
```

Replace with:
```ts
import "./globals.css";
```

- [ ] **Step 3.2: Delete styles.css**

```bash
rm /Users/boydroberts/Documents/projects/world-asset-prices/src/styles.css
```

- [ ] **Step 3.3: Verify dev server starts without errors**

```bash
npm run dev &
sleep 4
kill %1
```

Expected: no CSS import errors in output.

- [ ] **Step 3.4: Commit**

```bash
git add src/main.tsx
git rm src/styles.css
git commit -m "refactor: switch to globals.css, remove styles.css"
```

---

## Task 4: Create useTheme hook

**Files:**
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 4.1: Write the hook**

Create `src/hooks/useTheme.ts` with this content:

```ts
import { useCallback, useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "wap.theme.v1";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
```

- [ ] **Step 4.2: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 4.3: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "feat: add useTheme hook with localStorage and prefers-color-scheme"
```

---

## Task 5: Add theme toggle button and "last updated" timestamp to App.tsx

**Files:**
- Modify: `src/App.tsx`

The App.tsx changes are additive — no existing logic is removed. We:
1. Import `useTheme`
2. Call the hook in `App()`
3. Add a `.hero-top-row` wrapper div in the hero that puts the theme toggle top-right
4. Add a `formattedUpdatedAt` derived value
5. Render it in the status bar

- [ ] **Step 5.1: Add useTheme import**

In `src/App.tsx`, find the existing imports block (it starts with `import { useQuery }...`). Add the useTheme import after the existing hooks import:

```ts
import { useTheme } from "./hooks/useTheme";
```

- [ ] **Step 5.2: Call useTheme inside the App function**

Find this line inside `function App()`:
```ts
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
```

Add this line immediately before it:
```ts
  const { theme, toggleTheme } = useTheme();
```

- [ ] **Step 5.3: Add formattedUpdatedAt derived value**

Find this block:
```ts
  const statusTone = hasError ? "status error" : isBooting ? "status loading" : isStale ? "status stale" : "status live";
```

Add these lines immediately before it:
```ts
  const formattedUpdatedAt = (() => {
    if (!dashboard?.generatedAt) return null;
    const ms = Date.parse(dashboard.generatedAt);
    if (!Number.isFinite(ms)) return null;
    return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date(ms));
  })();
```

- [ ] **Step 5.4: Update the hero JSX**

Find this exact block in the JSX return:
```tsx
      <header className="hero">
        <p className="eyebrow">World Asset Prices</p>
        <h1>
          Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">Top 10 global assets, top 10 stocks, top 10 cryptocurrencies, and NIGHT price.</p>

        <div className={statusTone} role="status" aria-live="polite" aria-atomic="true" aria-label={statusAriaLabel}>
          <span>{statusPrefix}</span>
          <span className="status-refresh" aria-hidden="true">
            {` - refresh in ${secondsToRefresh}s`}
          </span>
        </div>
      </header>
```

Replace it with:
```tsx
      <header className="hero">
        <div className="hero-top-row">
          <p className="eyebrow">World Asset Prices</p>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
        <h1>
          Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">Top 10 global assets, top 10 stocks, top 10 cryptocurrencies, and NIGHT price.</p>

        <div className={statusTone} role="status" aria-live="polite" aria-atomic="true" aria-label={statusAriaLabel}>
          <span>{statusPrefix}</span>
          {formattedUpdatedAt ? (
            <span className="status-updated" aria-hidden="true">
              {` · Updated ${formattedUpdatedAt}`}
            </span>
          ) : null}
          <span className="status-refresh" aria-hidden="true">
            {` · refresh in ${secondsToRefresh}s`}
          </span>
        </div>
      </header>
```

- [ ] **Step 5.5: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 5.6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add theme toggle button and last-updated timestamp to header"
```

---

## Task 6: Fix package.json branding fields

**Files:**
- Modify: `package.json`

- [ ] **Step 6.1: Update name, description, author**

Open `package.json`. Find:
```json
  "name": "world-asset-prices",
  "private": true,
  "version": "0.1.0",
  "description": "Live dashboard tracking top 10 cryptos, top 10 stocks, and top 10 global assets by market cap — with resilient API fallbacks and production quality gates.",
  "author": "World Asset Prices Maintainers",
```

Replace with:
```json
  "name": "world-asset-prices",
  "private": true,
  "version": "1.0.0",
  "description": "World Asset Prices — live dashboard tracking the top 10 cryptos, stocks, and global assets by market cap, with light/dark mode, sparklines, watchlist, and resilient API fallbacks.",
  "author": "Boyd Roberts",
```

- [ ] **Step 6.2: Commit**

```bash
git add package.json
git commit -m "chore: update package.json branding and bump to v1.0.0"
```

---

## Task 7: Rewrite README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 7.1: Write the new README**

Replace the entire contents of `README.md` with:

```markdown
# World Asset Prices

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat&logo=reactquery&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=flat&logo=framer&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?style=flat&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat&logo=playwright&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

**Live Site:** [coleyrockin.github.io/cryptoprice](https://coleyrockin.github.io/cryptoprice/)

---

![Dashboard preview](docs/site-preview.png)

---

## About

World Asset Prices is a full-stack React + Vercel dashboard tracking the top 10 cryptocurrencies, top 10 stocks, and top 10 global assets by market cap — live. Built with a resilient data layer (provider cache → stale fallback → durable cache), smooth Framer Motion animations, and a polished dark/light UI that works across all screen sizes.

A single `GET /api/dashboard` call powers the entire payload. The frontend never talks to external APIs directly.

## Features

- **Three asset categories** — cryptocurrencies, stocks, and global assets ranked by market cap
- **Light / dark mode** — toggles instantly, respects `prefers-color-scheme` on first load, persists preference
- **Search & filter** — find any asset by name or symbol across all categories simultaneously
- **Sort modes** — by rank, market cap, 24h change (high/low), or name
- **24h price change** — color-coded green/red on every card
- **7-day sparklines** — mini SVG trend charts on every crypto card
- **Watchlist** — pin assets to the top with localStorage persistence across sessions
- **Compare mode** — side-by-side comparison panel for up to 3 cryptocurrencies
- **Midnight Token (NIGHT) panel** — dedicated price display with ATH, market cap, and 24h volume
- **Last updated timestamp** — displays exact time of the most recent data snapshot
- **Auto-refresh** — refetches every 30 seconds via TanStack Query
- **Resilient data layer** — live → fresh cache → stale-if-error fallback → durable cache (Upstash/Vercel KV)
- **Production quality gates** — lint, typecheck, unit tests, E2E smoke tests, and bundle size check in CI

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, TanStack React Query 5 |
| **Styling** | Tailwind CSS v4, clsx |
| **Animation** | Framer Motion 12 |
| **Backend** | Vercel Serverless Functions (Node 20) |
| **Data sources** | CoinPaprika (crypto), Financial Modeling Prep (stocks) |
| **Testing** | Vitest 4, Testing Library, Playwright E2E |
| **Linting** | ESLint 10, typescript-eslint |
| **Deployment** | Vercel (primary), GitHub Pages (static fallback) |

## Getting Started

```bash
# Clone
git clone https://github.com/coleyrockin/cryptoprice.git
cd cryptoprice

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Add your FMP_API_KEY (see Environment Variables below)

# Start the dev server
npm run dev
```

The app runs at `http://localhost:5188`.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `FMP_API_KEY` | **Yes** | Financial Modeling Prep API key for stock data |
| `FMP_BASE_URL` | No | Override FMP base URL (default: `https://financialmodelingprep.com/api/v3`) |
| `COINPAPRIKA_BASE_URL` | No | Override CoinPaprika base URL |
| `CACHE_TTL_SEC` | No | How long to cache live data (default: `30`) |
| `FALLBACK_TTL_SEC` | No | How long stale cache is valid (default: `600`) |
| `KV_REST_API_URL` | No | Upstash/Vercel KV URL for durable cache |
| `KV_REST_API_TOKEN` | No | Upstash/Vercel KV token |

Get a free FMP API key at [financialmodelingprep.com](https://financialmodelingprep.com/developer/docs/).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5188 |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit/integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run check` | Full CI pipeline (lint + typecheck + test + build + bundle check) |

## Project Structure

```
cryptoprice/
├── .github/           # CI workflows and issue templates
├── api/               # Vercel serverless endpoints
│   ├── dashboard.ts   # Main data endpoint — GET /api/dashboard
│   ├── logo.ts        # Logo proxy — GET /api/logo?url=...
│   └── health.ts      # Health check — GET /api/health
├── server/            # Server-side logic (shared by api/ and dev server)
│   ├── providers/     # CoinPaprika and FMP data providers
│   ├── cache.ts       # In-memory cache with TTL
│   ├── durable-cache.ts # Upstash/Vercel KV integration
│   └── dashboard.ts   # Dashboard payload assembly
├── src/               # React frontend
│   ├── components/    # MarketCard, SectionHeader, LogoMark, etc.
│   ├── hooks/         # useTheme, useTilt
│   ├── lib/           # formatters, monogram utilities
│   ├── types/         # Shared TypeScript types
│   ├── App.tsx        # Main app component
│   └── globals.css    # Tailwind v4 entry + theme variables
├── tests/e2e/         # Playwright smoke tests
├── index.html         # Entry HTML
├── vite.config.ts     # Vite configuration (includes local API dev plugin)
├── vercel.json        # Vercel deployment config
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and run `npm run check` to verify everything passes
4. Commit with a descriptive message: `git commit -m "feat: add your feature"`
5. Open a pull request against `main`

Please open an issue first for significant changes.

## License

MIT © Boyd Roberts
```

- [ ] **Step 7.2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with World Asset Prices branding and full feature docs"
```

---

## Task 8: Build verification

**Files:** None modified — verification only.

- [ ] **Step 8.1: Run typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 8.2: Run lint**

```bash
npm run lint
```

Expected: exits 0, no errors.

- [ ] **Step 8.3: Run unit tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 8.4: Run production build**

```bash
npm run build
```

Expected: exits 0, produces `dist/` with `index.html` and hashed assets.

- [ ] **Step 8.5: Run bundle check**

```bash
npm run check:bundle
```

Expected: exits 0.

- [ ] **Step 8.6: Final commit (if any fixes were needed)**

If any of the above steps required fixes, commit those changes with descriptive messages before this step. If everything passed cleanly, this step is a no-op.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Tailwind v4 installed and wired into Vite — Task 1
- ✅ globals.css replaces styles.css with full dual-theme CSS vars — Task 2 + 3
- ✅ `useTheme` hook with localStorage + prefers-color-scheme — Task 4
- ✅ Theme toggle button in hero (sun/moon SVG, no icon lib) — Task 5
- ✅ Light palette defined in `:root` / `html:not(.dark)` vars — Task 2
- ✅ "Last updated at HH:MM:SS" in status bar — Task 5
- ✅ package.json name/version/author updated — Task 6
- ✅ README rewritten with WAP branding, screenshot, env vars, contributing — Task 7
- ✅ Build verification — Task 8
- ✅ Mobile responsive breakpoints included in globals.css — Task 2

**No placeholders, no TBDs, no "similar to task N" references.**

**Type consistency:** `useTheme` returns `{ theme: "dark" | "light", toggleTheme: () => void }`. App.tsx uses both correctly. No type mismatches across tasks.

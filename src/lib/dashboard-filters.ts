import {
  dashboardEntryMatches,
  sortDashboardEntries,
  type DashboardEntry,
  type DashboardSegmentHealth,
  type DashboardSortMode,
} from "./dashboard-insights";
import { parseStoredHoldings } from "./portfolio";
import type { LocalHolding } from "../types/dashboard";

export const SECTION_IDS = [
  "section-watchlist",
  "section-portfolio",
  "section-assets",
  "section-stocks",
  "section-private-companies",
  "section-etfs",
  "section-currencies",
  "section-cryptos",
  "section-night",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export type SectionFilter = "all" | "assets" | "stocks" | "private" | "etfs" | "currencies" | "cryptos";
export type DensityMode = "comfortable" | "compact";

export const SECTION_FILTERS: ReadonlyArray<{ value: SectionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "assets", label: "Assets" },
  { value: "stocks", label: "Public" },
  { value: "private", label: "Private" },
  { value: "etfs", label: "ETFs" },
  { value: "currencies", label: "FX" },
  { value: "cryptos", label: "Crypto" },
];

export const SORT_OPTIONS: ReadonlyArray<{ value: DashboardSortMode; label: string }> = [
  { value: "rank", label: "Rank" },
  { value: "name", label: "Name" },
  { value: "value", label: "Value" },
  { value: "movement", label: "Move" },
];

export const SECTION_LINKS: ReadonlyArray<{
  id: SectionId;
  label: string;
  filter: SectionFilter | "watchlist" | "portfolio";
}> = [
  { id: "section-watchlist", label: "Watchlist", filter: "watchlist" },
  { id: "section-portfolio", label: "Portfolio", filter: "portfolio" },
  { id: "section-assets", label: "Global Assets", filter: "assets" },
  { id: "section-stocks", label: "Public Companies", filter: "stocks" },
  { id: "section-private-companies", label: "Private Companies", filter: "private" },
  { id: "section-etfs", label: "ETFs", filter: "etfs" },
  { id: "section-currencies", label: "Currencies", filter: "currencies" },
  { id: "section-cryptos", label: "Cryptos", filter: "cryptos" },
  { id: "section-night", label: "NIGHT", filter: "all" },
];

export const VALID_SECTION_FILTERS: SectionFilter[] = [
  "all",
  "assets",
  "stocks",
  "private",
  "etfs",
  "currencies",
  "cryptos",
];
export const VALID_SORT_MODES: DashboardSortMode[] = ["rank", "name", "value", "movement"];
export const VALID_DENSITY: DensityMode[] = ["comfortable", "compact"];

export const DEFAULT_REFRESH_SEC = 30;
export const PINNED_STORAGE_KEY = "wap.pinned-markets.v1";
export const PREFS_STORAGE_KEY = "wap.prefs.v1";
export const PORTFOLIO_STORAGE_KEY = "wap.portfolio.v1";

export type StoredPrefs = {
  sectionFilter: SectionFilter;
  sortMode: DashboardSortMode;
  density: DensityMode;
};

export function readStoredPinnedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeStoredPinnedIds(ids: readonly string[]) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore private browsing / quota failures.
  }
}

export function readStoredPrefs(): Partial<StoredPrefs> {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    const out: Partial<StoredPrefs> = {};
    if (parsed.sectionFilter && VALID_SECTION_FILTERS.includes(parsed.sectionFilter)) out.sectionFilter = parsed.sectionFilter;
    if (parsed.sortMode && VALID_SORT_MODES.includes(parsed.sortMode)) out.sortMode = parsed.sortMode;
    if (parsed.density && VALID_DENSITY.includes(parsed.density)) out.density = parsed.density;
    return out;
  } catch {
    return {};
  }
}

export function writeStoredPrefs(prefs: StoredPrefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore private browsing / quota failures.
  }
}

export function readStoredHoldings(): LocalHolding[] {
  try {
    return parseStoredHoldings(localStorage.getItem(PORTFOLIO_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeStoredHoldings(holdings: readonly LocalHolding[]) {
  try {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // Ignore private browsing / quota failures.
  }
}

export function buildPriceTitle(exact: string, generatedAt: string | undefined, prefix = "Exact"): string {
  const stamp = generatedAt ? new Date(generatedAt).toLocaleString() : "live";
  return `${prefix}: ${exact} · Updated ${stamp}`;
}

export function formatRelativeTime(fromIso: string | undefined, now: number): string {
  if (!fromIso) return "—";
  const then = new Date(fromIso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

export const SOURCE_LABEL: Record<DashboardSegmentHealth["source"], string> = {
  live: "Live",
  "fresh-cache": "Live",
  "stale-cache": "Stale cache",
  "durable-cache": "Durable cache",
  fallback: "Fallback",
};

export function formatSegmentAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3_600)}h`;
}

export function sourceTone(source: DashboardSegmentHealth["source"]): "positive" | "warning" | "negative" {
  if (source === "live" || source === "fresh-cache") return "positive";
  if (source === "stale-cache" || source === "durable-cache") return "warning";
  return "negative";
}

/**
 * Apply the dashboard's search term + sort mode to an entry collection.
 * Pure helper used by the dashboard filter hook for each section's visible list.
 */
export function filterAndSortEntries<T extends DashboardEntry>(
  entries: readonly T[],
  searchTerm: string,
  sortMode: DashboardSortMode,
): T[] {
  return sortDashboardEntries(
    entries.filter((entry) => dashboardEntryMatches(entry, searchTerm)),
    sortMode,
  );
}

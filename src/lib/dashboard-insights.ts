import { formatCompactCurrency, formatPercent, isFiniteNumber } from "./formatters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardNight,
  DashboardPayload,
  DashboardStock,
} from "../types/dashboard";

export type DashboardEntry = DashboardAsset | DashboardCrypto | DashboardCurrency | DashboardEtf | DashboardStock;

export type DashboardSortMode = "rank" | "name" | "value" | "movement";

export type DashboardInsight = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "negative";
};

function normalizedText(value: string): string {
  return value.trim().toLowerCase();
}

export function dashboardEntryMatches(entry: DashboardEntry, searchTerm: string): boolean {
  const term = normalizedText(searchTerm);
  if (!term) return true;

  return [entry.name, entry.symbol, entry.category].some((value) => normalizedText(value).includes(term));
}

export function getEntryValue(entry: DashboardEntry): number | null {
  if ("rateVsUsd" in entry) return isFiniteNumber(entry.rateVsUsd) ? entry.rateVsUsd : null;
  if ("priceUsd" in entry && isFiniteNumber(entry.priceUsd)) return entry.priceUsd;
  if ("marketCapUsd" in entry && isFiniteNumber(entry.marketCapUsd)) return entry.marketCapUsd;
  if ("aumUsd" in entry && isFiniteNumber(entry.aumUsd)) return entry.aumUsd;
  return null;
}

export function getEntryChange(entry: DashboardEntry): number | null {
  if ("change24h" in entry) return isFiniteNumber(entry.change24h) ? entry.change24h : null;
  if ("changePercent" in entry) return isFiniteNumber(entry.changePercent) ? entry.changePercent : null;
  return null;
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

export function sortDashboardEntries<T extends DashboardEntry>(entries: readonly T[], sortMode: DashboardSortMode): T[] {
  return [...entries].sort((a, b) => {
    if (sortMode === "name") {
      return compareText(a.name, b.name);
    }

    if (sortMode === "value") {
      return compareNullableDesc(getEntryValue(a), getEntryValue(b)) || a.rank - b.rank || compareText(a.name, b.name);
    }

    if (sortMode === "movement") {
      const movementA = getEntryChange(a);
      const movementB = getEntryChange(b);
      return compareNullableDesc(movementA === null ? null : Math.abs(movementA), movementB === null ? null : Math.abs(movementB)) || a.rank - b.rank || compareText(a.name, b.name);
    }

    return a.rank - b.rank || compareText(a.name, b.name);
  });
}

function countTrackedMarkets(dashboard: DashboardPayload): number {
  return (
    dashboard.topAssets.length +
    dashboard.topStocks.length +
    dashboard.topEtfs.length +
    dashboard.topCurrencies.length +
    dashboard.topCryptos.length +
    (dashboard.night ? 1 : 0)
  );
}

function getFreshSegmentCount(dashboard: DashboardPayload): number {
  return Object.values(dashboard.segmentMeta).filter((meta) => meta.source === "live" || meta.source === "fresh-cache").length;
}

function getLargestMover(dashboard: DashboardPayload): DashboardInsight {
  const entries: DashboardEntry[] = [
    ...dashboard.topCryptos,
    ...dashboard.topStocks,
    ...dashboard.topEtfs,
    ...dashboard.topCurrencies,
  ];

  const nightMover = dashboard.night && isFiniteNumber(dashboard.night.change24h)
    ? {
        name: dashboard.night.name,
        symbol: dashboard.night.symbol,
        change: dashboard.night.change24h,
      }
    : null;

  const largest = entries
    .map((entry) => ({ name: entry.name, symbol: entry.symbol, change: getEntryChange(entry) }))
    .concat(nightMover ? [nightMover] : [])
    .filter((entry): entry is { name: string; symbol: string; change: number } => isFiniteNumber(entry.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];

  if (!largest) {
    return {
      label: "Largest move",
      value: "—",
      detail: "Waiting for change data",
      tone: "neutral",
    };
  }

  return {
    label: "Largest move",
    value: formatPercent(largest.change),
    detail: `${largest.name} (${largest.symbol})`,
    tone: largest.change > 0 ? "positive" : largest.change < 0 ? "negative" : "neutral",
  };
}

function getGlobalLeader(topAssets: readonly DashboardAsset[]): DashboardInsight {
  const leader = sortDashboardEntries(topAssets, "rank")[0];
  if (!leader) {
    return {
      label: "Global leader",
      value: "—",
      detail: "Waiting for asset data",
      tone: "neutral",
    };
  }

  return {
    label: "Global leader",
    value: formatCompactCurrency(leader.marketCapUsd).replace(/\.00(?=[A-Z]?$)/, ""),
    detail: `${leader.name} (${leader.symbol})`,
    tone: "neutral",
  };
}

export function buildDashboardInsights(dashboard: DashboardPayload): DashboardInsight[] {
  const totalSegments = Object.keys(dashboard.segmentMeta).length;
  const freshSegments = getFreshSegmentCount(dashboard);
  const degradedCount = dashboard.degradedSegments.length;
  const isDegraded = dashboard.stale || dashboard.source.fallbackUsed || degradedCount > 0;

  return [
    {
      label: "Tracked markets",
      value: String(countTrackedMarkets(dashboard)),
      detail: `Across ${totalSegments} live sections`,
      tone: "neutral",
    },
    {
      label: "Data health",
      value: isDegraded ? "Degraded" : "Live",
      detail: isDegraded
        ? `${degradedCount || 1} ${degradedCount === 1 ? "segment" : "segments"} using fallback data`
        : `${freshSegments} of ${totalSegments} segments fresh`,
      tone: isDegraded ? "warning" : "positive",
    },
    getLargestMover(dashboard),
    getGlobalLeader(dashboard.topAssets),
  ];
}

export function nightAsPinnedEntry(night: DashboardNight): DashboardCrypto {
  return {
    id: night.id,
    rank: 1,
    name: night.name,
    symbol: night.symbol,
    category: "Crypto",
    priceUsd: night.priceUsd,
    marketCapUsd: night.marketCapUsd,
    change24h: night.change24h,
    sparkline7d: [],
    logoUrl: night.logoUrl,
    fallbackLogoUrls: night.fallbackLogoUrls,
  };
}

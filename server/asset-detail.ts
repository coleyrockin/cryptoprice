import { assetRefFromEntry, findDashboardEntry, getFallbackAssetRef, isHistoricalRange, segmentForEntry } from "./asset-registry.js";
import { buildDashboardPayload } from "./dashboard.js";
import { EQUITY_FUNDAMENTALS_AS_OF, fetchHistoricalPricesFromStooq } from "./providers/stooq.js";
import { toFiniteNumber } from "./sanitize.js";
import { getAssetValueSource } from "./value-sources.js";
import type {
  AssetDetailPayload,
  AssetProvenance,
  DashboardPayload,
  DashboardSegmentSource,
  HistoricalPoint,
  HistoricalRange,
  AssetValueSource,
} from "./types.js";

export type BuildAssetDetailOptions = {
  id: string;
  range: HistoricalRange;
  now?: () => number;
  timeoutMs?: number;
  dashboard?: DashboardPayload;
};

function formatIsoFromAge(nowMs: number, ageSec: number): string {
  return new Date(nowMs - Math.max(0, ageSec) * 1_000).toISOString();
}

function unsupportedHistoryReason(category: string): string {
  if (category === "Private Company") return "Private-company valuations are curated snapshots, not traded historical prices.";
  if (category === "Currency") return "FX history is not available from the current no-key dashboard provider in this version.";
  if (category === "Crypto" || category === "NIGHT") return "Crypto detail history needs a dedicated historical provider; current sparklines are not treated as historical prices.";
  if (category === "Commodity") return "Commodity history is not available from the current no-key dashboard provider in this version.";
  return "History is unavailable for this asset in the current provider set.";
}

function isPricedEntry(entry: NonNullable<ReturnType<typeof findDashboardEntry>>): boolean {
  return "priceUsd" in entry && typeof entry.priceUsd === "number" && Number.isFinite(entry.priceUsd);
}

function sourceFromSegment(payload: DashboardPayload, segment: ReturnType<typeof segmentForEntry>): DashboardSegmentSource | "curated" {
  if (segment === "topAssets") return payload.stale ? "fallback" : "fresh-cache";
  return payload.segmentMeta[segment]?.source ?? "fallback";
}

function ageFromSegment(payload: DashboardPayload, segment: ReturnType<typeof segmentForEntry>): number {
  if (segment === "topAssets") return 0;
  return payload.segmentMeta[segment]?.ageSec ?? 0;
}

function providerForEntry(entry: NonNullable<ReturnType<typeof findDashboardEntry>>): string {
  if (entry.category === "Stock") return isPricedEntry(entry) ? "Stooq / Yahoo Finance fallback" : "Curated public-company snapshot";
  if (entry.category === "ETF") return "Stooq / Yahoo quote; sourced AUM snapshot";
  const category = entry.category;
  if (category === "Crypto" || category === "NIGHT") return "CoinPaprika";
  if (category === "Currency") return "Frankfurter / ECB";
  if (category === "Private Company") return "Curated private-company snapshot";
  if (category === "Commodity") return "Curated commodity estimate";
  return "World Asset Prices";
}

function valueMethodForEntry(entry: NonNullable<ReturnType<typeof findDashboardEntry>>): AssetProvenance["valueMethod"] {
  if (entry.category === "Stock") return isPricedEntry(entry) ? "derived-market-cap" : "curated-market-cap";
  if (entry.category === "ETF") return "sourced-aum";
  if (entry.category === "Currency") return "exchange-rate";
  if (entry.category === "Private Company") return "curated-valuation";
  if (entry.category === "Commodity") return "commodity-estimate";
  if (entry.category === "Crypto" || entry.category === "NIGHT") return "live-price";
  return "unavailable";
}

function confidenceForEntry(
  entry: NonNullable<ReturnType<typeof findDashboardEntry>>,
  source: AssetProvenance["source"],
  valueSource: AssetValueSource | undefined,
): AssetProvenance["confidence"] {
  if (valueSource) return valueSource.confidence;
  if (entry.category === "Private Company") return "curated";
  if (source === "fallback" || source === "durable-cache") return "low";
  if (entry.category === "Stock" || entry.category === "ETF" || entry.category === "Commodity") return "medium";
  return "high";
}

function limitationForEntry(entry: NonNullable<ReturnType<typeof findDashboardEntry>>): string {
  if (entry.category === "Stock" && isPricedEntry(entry)) return `Market cap is estimated from live equity quote price and public share count baseline as of ${EQUITY_FUNDAMENTALS_AS_OF}.`;
  if (entry.category === "Stock") return "Market cap is a verified curated snapshot because this exchange is not available through the current no-key live quote path.";
  if (entry.category === "ETF") return "AUM is a sourced snapshot; unit price is live when the free quote provider is available.";
  if (entry.category === "Private Company") return "Private-company value is a verified curated primary valuation. Speculative targets are shown only as alternate context.";
  if (entry.category === "Currency") return "FX rates are based on the current free provider feed and may update on a daily/business-day cadence.";
  if (entry.category === "Commodity") return "Commodity value is a curated global estimate included for cross-asset context.";
  if (entry.category === "Crypto" || entry.category === "NIGHT") return "Crypto values are live provider quotes, but this version does not use them as historical chart data.";
  return "Value availability depends on the current provider set.";
}

function quoteForEntry(entry: NonNullable<ReturnType<typeof findDashboardEntry>>, asOf: string): AssetDetailPayload["quote"] {
  if ("aumUsd" in entry) {
    return {
      valueUsd: toFiniteNumber(entry.aumUsd),
      priceUsd: toFiniteNumber(entry.priceUsd),
      changePercent: toFiniteNumber(entry.changePercent),
      valueLabel: "Sourced AUM",
      asOf,
    };
  }

  if ("rateVsUsd" in entry) {
    return {
      valueUsd: toFiniteNumber(entry.rateVsUsd),
      changePercent: toFiniteNumber(entry.changePercent),
      valueLabel: "Rate vs USD",
      asOf,
    };
  }

  if ("priceUsd" in entry) {
    return {
      valueUsd: toFiniteNumber(entry.marketCapUsd),
      priceUsd: toFiniteNumber(entry.priceUsd),
      changePercent: "change24h" in entry ? toFiniteNumber(entry.change24h) : toFiniteNumber(entry.changePercent),
      valueLabel: entry.category === "Stock" && !isPricedEntry(entry) ? "Verified market cap" : entry.category === "Stock" ? "Estimated market cap" : "Market cap",
      asOf,
    };
  }

  return {
    valueUsd: toFiniteNumber(entry.marketCapUsd),
    valueLabel: entry.category === "Private Company" ? "Verified valuation" : "Estimated market cap",
    asOf,
  };
}

async function historyForEntry(
  entry: NonNullable<ReturnType<typeof findDashboardEntry>>,
  range: HistoricalRange,
  timeoutMs: number,
): Promise<{ points: HistoricalPoint[]; reason?: string }> {
  if (entry.category !== "Stock" && entry.category !== "ETF") {
    return { points: [], reason: unsupportedHistoryReason(entry.category) };
  }

  if (!isPricedEntry(entry)) {
    return { points: [], reason: "Historical chart unavailable for curated market-cap snapshots in the current no-key provider set." };
  }

  try {
    return {
      points: await fetchHistoricalPricesFromStooq(entry.symbol, range, { timeoutMs }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown provider error";
    return {
      points: [],
      reason: `Stooq history unavailable: ${message}`,
    };
  }
}

export async function buildAssetDetailPayload(options: BuildAssetDetailOptions): Promise<AssetDetailPayload> {
  if (!getFallbackAssetRef(options.id)) {
    throw new Error("unknown_asset");
  }

  if (!isHistoricalRange(options.range)) {
    throw new Error("invalid_range");
  }

  const nowMs = options.now ? options.now() : Date.now();
  const dashboard = options.dashboard ?? await buildDashboardPayload({ timeoutMs: options.timeoutMs });
  const entry = findDashboardEntry(dashboard, options.id);
  if (!entry) {
    throw new Error("asset_not_available");
  }

  const segment = segmentForEntry(entry);
  const source = entry.category === "Private Company" ? "curated" : sourceFromSegment(dashboard, segment);
  const ageSec = entry.category === "Private Company" ? 0 : ageFromSegment(dashboard, segment);
  const asOf = dashboard.generatedAt;
  const history = await historyForEntry(entry, options.range, options.timeoutMs ?? 4_500);
  const stale = source === "stale-cache" || source === "fallback" || source === "durable-cache";
  const valueSource = getAssetValueSource(entry.id);

  return {
    asset: assetRefFromEntry(entry),
    quote: quoteForEntry(entry, asOf),
    history: {
      range: options.range,
      available: history.points.length > 0,
      points: history.points,
      reason: history.points.length > 0 ? undefined : history.reason,
    },
    provenance: {
      provider: providerForEntry(entry),
      source,
      segment,
      ageSec,
      updatedAt: formatIsoFromAge(nowMs, ageSec),
      valueMethod: valueMethodForEntry(entry),
      confidence: confidenceForEntry(entry, source, valueSource),
      limitation: limitationForEntry(entry),
      valueAsOf: valueSource?.valueAsOf,
      sourceUrl: valueSource?.sourceUrl,
      sourceTitle: valueSource?.sourceTitle,
      sourceType: valueSource?.sourceType,
      alternateValuations: valueSource?.alternateValuations,
    },
    stale,
    degradedReason: stale ? `Using ${source} data for this asset.` : history.points.length > 0 ? undefined : history.reason,
  };
}

import { runtimeCache, type MemoryCache } from "./cache";
import fallbackPayloadJson from "./fallback/dashboard-fallback.json";
import { recordProviderFailure, recordProviderFallback, recordProviderSuccess, type ProviderMetricKey } from "./metrics";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopStocksFromFmp } from "./providers/fmp";
import { toFiniteNumber } from "./sanitize";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardNight,
  DashboardPayload,
  DashboardSegmentKey,
  DashboardSegmentSource,
  DashboardStock,
} from "./types";

type Logger = Pick<Console, "info" | "warn" | "error">;

type SegmentResult<T> = {
  data: T;
  stale: boolean;
  fallbackUsed: boolean;
  source: DashboardSegmentSource;
  updatedAtMs: number;
};

export type DashboardBuildOptions = {
  cache?: MemoryCache;
  now?: () => number;
  logger?: Logger;
  cacheTtlSec?: number;
  fallbackTtlSec?: number;
  timeoutMs?: number;
  retries?: number;
  fmpApiKey?: string;
  coinpaprikaBaseUrl?: string;
};

const FALLBACK_PAYLOAD = fallbackPayloadJson as DashboardPayload;
const FALLBACK_GENERATED_AT_MS = Date.parse(FALLBACK_PAYLOAD.generatedAt);

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "night"];

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeStocks(stocks: DashboardStock[]): DashboardStock[] {
  return stocks.map((stock, index) => ({
    ...stock,
    rank: index + 1,
    marketCapUsd: toFiniteNumber(stock.marketCapUsd),
    priceUsd: toFiniteNumber(stock.priceUsd),
    changePercent: toFiniteNumber(stock.changePercent),
  }));
}

function normalizeCryptos(cryptos: DashboardCrypto[]): DashboardCrypto[] {
  return cryptos.map((crypto, index) => ({
    ...crypto,
    rank: index + 1,
    priceUsd: toFiniteNumber(crypto.priceUsd),
    marketCapUsd: toFiniteNumber(crypto.marketCapUsd),
    change24h: toFiniteNumber(crypto.change24h),
    sparkline7d: Array.isArray(crypto.sparkline7d)
      ? crypto.sparkline7d
          .map((point) => toFiniteNumber(point))
          .filter((point): point is number => point !== null)
          .slice(-12)
      : [],
  }));
}

function normalizeNight(night: DashboardNight | null): DashboardNight | null {
  if (!night) {
    return null;
  }

  return {
    ...night,
    priceUsd: toFiniteNumber(night.priceUsd),
    marketCapUsd: toFiniteNumber(night.marketCapUsd),
    volume24hUsd: toFiniteNumber(night.volume24hUsd),
    athPriceUsd: toFiniteNumber(night.athPriceUsd),
    change24h: toFiniteNumber(night.change24h),
    percentFromAth: toFiniteNumber(night.percentFromAth),
  };
}

function normalizeAssets(assets: DashboardAsset[]): DashboardAsset[] {
  return assets
    .map((asset) => ({
      ...asset,
      marketCapUsd: toFiniteNumber(asset.marketCapUsd),
    }))
    .sort((left, right) => {
      const leftValue = left.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      const rightValue = right.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    })
    .slice(0, 10)
    .map((asset, index) => ({
      ...asset,
      rank: index + 1,
    }));
}

function getCommodityAssets(): DashboardAsset[] {
  return FALLBACK_PAYLOAD.topAssets
    .filter((asset) => asset.category === "Commodity")
    .map((asset) => ({
      ...asset,
      rank: 0,
    }));
}

function buildTopAssets(topStocks: DashboardStock[], topCryptos: DashboardCrypto[]): DashboardAsset[] {
  const stockAssets: DashboardAsset[] = topStocks.map((stock) => ({
    id: stock.id,
    rank: stock.rank,
    name: stock.name,
    symbol: stock.symbol,
    category: "Stock",
    marketCapUsd: stock.marketCapUsd,
    logoUrl: stock.logoUrl,
    fallbackLogoUrls: stock.fallbackLogoUrls,
  }));

  const cryptoAssets: DashboardAsset[] = topCryptos.slice(0, 5).map((crypto) => ({
    id: crypto.id,
    rank: crypto.rank,
    name: crypto.name,
    symbol: crypto.symbol,
    category: "Crypto",
    marketCapUsd: crypto.marketCapUsd,
    logoUrl: crypto.logoUrl,
    fallbackLogoUrls: crypto.fallbackLogoUrls,
  }));

  const deduped = new Map<string, DashboardAsset>();
  for (const asset of [...getCommodityAssets(), ...stockAssets, ...cryptoAssets]) {
    deduped.set(asset.id, asset);
  }

  return normalizeAssets(Array.from(deduped.values()));
}

async function resolveSegment<T>(options: {
  key: string;
  metricKey: ProviderMetricKey;
  label: string;
  fetcher: () => Promise<T>;
  fallbackValue: T;
  fallbackUpdatedAtMs: number;
  cache: MemoryCache;
  nowMs: number;
  cacheTtlSec: number;
  fallbackTtlSec: number;
  logger: Logger;
}): Promise<SegmentResult<T>> {
  const fresh = options.cache.getFreshEntry<T>(options.key, options.cacheTtlSec, options.nowMs);
  if (fresh) {
    options.logger.info(`[dashboard] ${options.label} source=fresh-cache`);
    return {
      data: fresh.value,
      stale: false,
      fallbackUsed: false,
      source: "fresh-cache",
      updatedAtMs: fresh.updatedAt,
    };
  }

  const startedAt = Date.now();
  try {
    const live = await options.fetcher();
    options.cache.set(options.key, live, options.nowMs);
    const latencyMs = Date.now() - startedAt;
    recordProviderSuccess(options.metricKey, latencyMs);
    options.logger.info(`[dashboard] ${options.label} source=live latencyMs=${latencyMs}`);

    return {
      data: live,
      stale: false,
      fallbackUsed: false,
      source: "live",
      updatedAtMs: options.nowMs,
    };
  } catch (error) {
    recordProviderFailure(options.metricKey);
    const message = error instanceof Error ? error.message : "unknown error";
    options.logger.warn(`[dashboard] ${options.label} provider-failure reason=${message}`);

    const stale = options.cache.getStaleEntry<T>(options.key, options.fallbackTtlSec, options.nowMs);
    if (stale) {
      recordProviderFallback(options.metricKey);
      options.logger.warn(`[dashboard] ${options.label} source=stale-cache`);
      return {
        data: stale.value,
        stale: true,
        fallbackUsed: false,
        source: "stale-cache",
        updatedAtMs: stale.updatedAt,
      };
    }

    recordProviderFallback(options.metricKey);
    options.logger.warn(`[dashboard] ${options.label} source=fallback`);
    return {
      data: options.fallbackValue,
      stale: true,
      fallbackUsed: true,
      source: "fallback",
      updatedAtMs: options.fallbackUpdatedAtMs,
    };
  }
}

export async function buildDashboardPayload(options: DashboardBuildOptions = {}): Promise<DashboardPayload> {
  const cache = options.cache ?? runtimeCache;
  const nowMs = options.now ? options.now() : Date.now();
  const logger = options.logger ?? console;

  const cacheTtlSec = options.cacheTtlSec ?? envInt("CACHE_TTL_SEC", 60, 15, 300);
  const fallbackTtlSec = options.fallbackTtlSec ?? envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
  const staleAlertSec = envInt("STALE_ALERT_SEC", 300, 60, 86_400);
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = options.retries ?? 1;
  const fallbackUpdatedAtMs = Number.isFinite(FALLBACK_GENERATED_AT_MS) ? FALLBACK_GENERATED_AT_MS : nowMs;

  const [cryptosResult, stocksResult, nightResult] = await Promise.all([
    resolveSegment<DashboardCrypto[]>({
      key: "coinpaprika:top-cryptos",
      metricKey: "topCryptos",
      label: "topCryptos",
      fallbackValue: FALLBACK_PAYLOAD.topCryptos,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      fetcher: () =>
        fetchTopCryptosFromCoinpaprika({
          limit: 10,
          baseUrl: options.coinpaprikaBaseUrl,
          timeoutMs,
          retries,
        }),
    }),
    resolveSegment<DashboardStock[]>({
      key: "fmp:top-stocks",
      metricKey: "topStocks",
      label: "topStocks",
      fallbackValue: FALLBACK_PAYLOAD.topStocks,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      fetcher: () =>
        fetchTopStocksFromFmp({
          apiKey: options.fmpApiKey,
          limit: 10,
          timeoutMs,
          retries,
        }),
    }),
    resolveSegment<DashboardNight | null>({
      key: "coinpaprika:night",
      metricKey: "night",
      label: "night",
      fallbackValue: FALLBACK_PAYLOAD.night,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      fetcher: () =>
        fetchNightFromCoinpaprika({
          baseUrl: options.coinpaprikaBaseUrl,
          timeoutMs,
          retries,
        }),
    }),
  ]);

  const topCryptos = normalizeCryptos(cryptosResult.data);
  const topStocks = normalizeStocks(stocksResult.data);
  const topAssets = buildTopAssets(topStocks, topCryptos);
  const night = normalizeNight(nightResult.data);

  const stale = cryptosResult.stale || stocksResult.stale || nightResult.stale;
  const fallbackUsed = cryptosResult.fallbackUsed || stocksResult.fallbackUsed || nightResult.fallbackUsed;

  const segmentMeta = {
    topCryptos: {
      source: cryptosResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - cryptosResult.updatedAtMs) / 1_000)),
    },
    topStocks: {
      source: stocksResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - stocksResult.updatedAtMs) / 1_000)),
    },
    night: {
      source: nightResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - nightResult.updatedAtMs) / 1_000)),
    },
  } satisfies DashboardPayload["segmentMeta"];

  const degradedSegments = SEGMENT_KEYS.filter((segment) => {
    const source = segmentMeta[segment].source;
    return source === "stale-cache" || source === "fallback" || source === "durable-cache";
  });

  logger.info(`[dashboard] assembled stale=${stale} fallbackUsed=${fallbackUsed}`);
  for (const segment of degradedSegments) {
    if (segmentMeta[segment].ageSec >= staleAlertSec) {
      logger.warn(`[dashboard] stale-threshold segment=${segment} ageSec=${segmentMeta[segment].ageSec} thresholdSec=${staleAlertSec}`);
    }
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    stale,
    refreshInSec: cacheTtlSec,
    source: {
      equities: "fmp",
      crypto: "coinpaprika",
      fallbackUsed,
    },
    degradedSegments,
    segmentMeta,
    topCryptos,
    topStocks,
    topAssets,
    night,
  };
}

export const dashboardFallbackPayload = FALLBACK_PAYLOAD;

import { runtimeCache, type MemoryCache } from "./cache";
import fallbackPayloadJson from "./fallback/dashboard-fallback.json";
import { recordProviderFailure, recordProviderFallback, recordProviderSuccess, type ProviderMetricKey } from "./metrics";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopStocksFromFmp } from "./providers/fmp";
import { toFiniteNumber } from "./sanitize";
import type { DashboardAsset, DashboardCrypto, DashboardPayload, DashboardStock, DashboardNight } from "./types";

type Logger = Pick<Console, "info" | "warn" | "error">;

type SegmentSource = "fresh-cache" | "live" | "stale-cache" | "fallback";

type SegmentResult<T> = {
  data: T;
  stale: boolean;
  fallbackUsed: boolean;
  source: SegmentSource;
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
  cache: MemoryCache;
  nowMs: number;
  cacheTtlSec: number;
  fallbackTtlSec: number;
  logger: Logger;
}): Promise<SegmentResult<T>> {
  const fresh = options.cache.getFresh<T>(options.key, options.cacheTtlSec, options.nowMs);
  if (fresh) {
    options.logger.info(`[dashboard] ${options.label} source=fresh-cache`);
    return {
      data: fresh,
      stale: false,
      fallbackUsed: false,
      source: "fresh-cache",
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
    };
  } catch (error) {
    recordProviderFailure(options.metricKey);
    const message = error instanceof Error ? error.message : "unknown error";
    options.logger.warn(`[dashboard] ${options.label} provider-failure reason=${message}`);

    const stale = options.cache.getStale<T>(options.key, options.fallbackTtlSec, options.nowMs);
    if (stale) {
      recordProviderFallback(options.metricKey);
      options.logger.warn(`[dashboard] ${options.label} source=stale-cache`);
      return {
        data: stale,
        stale: true,
        fallbackUsed: false,
        source: "stale-cache",
      };
    }

    recordProviderFallback(options.metricKey);
    options.logger.warn(`[dashboard] ${options.label} source=fallback`);
    return {
      data: options.fallbackValue,
      stale: true,
      fallbackUsed: true,
      source: "fallback",
    };
  }
}

export async function buildDashboardPayload(options: DashboardBuildOptions = {}): Promise<DashboardPayload> {
  const cache = options.cache ?? runtimeCache;
  const nowMs = options.now ? options.now() : Date.now();
  const logger = options.logger ?? console;

  const cacheTtlSec = options.cacheTtlSec ?? envInt("CACHE_TTL_SEC", 60, 15, 300);
  const fallbackTtlSec = options.fallbackTtlSec ?? envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = options.retries ?? 1;

  const [cryptosResult, stocksResult, nightResult] = await Promise.all([
    resolveSegment<DashboardCrypto[]>({
      key: "coinpaprika:top-cryptos",
      metricKey: "topCryptos",
      label: "topCryptos",
      fallbackValue: FALLBACK_PAYLOAD.topCryptos,
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

  logger.info(`[dashboard] assembled stale=${stale} fallbackUsed=${fallbackUsed}`);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    stale,
    refreshInSec: cacheTtlSec,
    source: {
      equities: "fmp",
      crypto: "coinpaprika",
      fallbackUsed,
    },
    topCryptos,
    topStocks,
    topAssets,
    night,
  };
}

export const dashboardFallbackPayload = FALLBACK_PAYLOAD;

import { runtimeCache, type MemoryCache } from "./cache.js";
import { envInt } from "./env.js";
import fallbackPayloadJson from "./fallback/dashboard-fallback.json" with { type: "json" };
import { recordProviderFailure, recordProviderFallback, recordProviderSuccess, type ProviderMetricKey } from "./metrics.js";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika.js";
import { fetchTopCurrenciesFromFrankfurter } from "./providers/frankfurter.js";
import { fetchTopEtfsFromStooq, fetchTopStocksFromStooq } from "./providers/stooq.js";
import { toFiniteNumber } from "./sanitize.js";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardNight,
  DashboardPayload,
  DashboardSegmentKey,
  DashboardSegmentSource,
  DashboardStock,
} from "./types.js";

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
  coinpaprikaBaseUrl?: string;
};

const FALLBACK_PAYLOAD = fallbackPayloadJson as DashboardPayload;
const FALLBACK_GENERATED_AT_MS = Date.parse(FALLBACK_PAYLOAD.generatedAt);

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "night"];

type StaleAlertGlobal = typeof globalThis & {
  __WAP_STALE_ALERTS__?: Map<DashboardSegmentKey, number>;
};

const staleAlertGlobal = globalThis as StaleAlertGlobal;
const staleAlerts = staleAlertGlobal.__WAP_STALE_ALERTS__ ?? (staleAlertGlobal.__WAP_STALE_ALERTS__ = new Map());

function shouldEmitStaleAlert(segment: DashboardSegmentKey, thresholdSec: number, nowMs: number): boolean {
  const lastEmittedMs = staleAlerts.get(segment);
  if (lastEmittedMs && nowMs - lastEmittedMs < thresholdSec * 1_000) {
    return false;
  }

  staleAlerts.set(segment, nowMs);
  return true;
}

function normalizeStocks(stocks: DashboardStock[]): DashboardStock[] {
  // Early return for empty arrays
  if (stocks.length === 0) {
    return stocks;
  }

  return stocks.map((stock, index) => ({
    ...stock,
    rank: index + 1,
    marketCapUsd: toFiniteNumber(stock.marketCapUsd),
    priceUsd: toFiniteNumber(stock.priceUsd),
    changePercent: toFiniteNumber(stock.changePercent),
  }));
}

function normalizeCryptos(cryptos: DashboardCrypto[]): DashboardCrypto[] {
  // Early return for empty arrays
  if (cryptos.length === 0) {
    return cryptos;
  }

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

function normalizeCurrencies(currencies: DashboardCurrency[]): DashboardCurrency[] {
  if (!Array.isArray(currencies) || currencies.length === 0) {
    return currencies;
  }

  return currencies.map((currency, index) => ({
    ...currency,
    rank: index + 1,
    rateVsUsd: toFiniteNumber(currency.rateVsUsd),
    changePercent: toFiniteNumber(currency.changePercent),
  }));
}

function normalizeEtfs(etfs: DashboardEtf[]): DashboardEtf[] {
  if (etfs.length === 0) {
    return etfs;
  }

  return etfs.map((etf, index) => ({
    ...etf,
    rank: index + 1,
    aumUsd: toFiniteNumber(etf.aumUsd),
    priceUsd: toFiniteNumber(etf.priceUsd),
    changePercent: toFiniteNumber(etf.changePercent),
  }));
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
  // Pre-allocate Map for deduplication
  const commodityAssets = getCommodityAssets();
  const deduped = new Map<string, DashboardAsset>();

  // Add commodities first
  for (const asset of commodityAssets) {
    deduped.set(asset.id, asset);
  }

  // Add stocks (converting format inline)
  for (const stock of topStocks) {
    deduped.set(stock.id, {
      id: stock.id,
      rank: stock.rank,
      name: stock.name,
      symbol: stock.symbol,
      category: "Stock",
      marketCapUsd: stock.marketCapUsd,
      logoUrl: stock.logoUrl,
      fallbackLogoUrls: stock.fallbackLogoUrls,
    });
  }

  // Add top 5 cryptos only
  const cryptoLimit = Math.min(5, topCryptos.length);
  for (let i = 0; i < cryptoLimit; i++) {
    const crypto = topCryptos[i];
    deduped.set(crypto.id, {
      id: crypto.id,
      rank: crypto.rank,
      name: crypto.name,
      symbol: crypto.symbol,
      category: "Crypto",
      marketCapUsd: crypto.marketCapUsd,
      logoUrl: crypto.logoUrl,
      fallbackLogoUrls: crypto.fallbackLogoUrls,
    });
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

  const cacheTtlSec = options.cacheTtlSec ?? envInt("CACHE_TTL_SEC", 30, 15, 300);
  const fallbackTtlSec = options.fallbackTtlSec ?? envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
  const staleAlertSec = envInt("STALE_ALERT_SEC", 300, 60, 86_400);
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = options.retries ?? 1;
  const fallbackUpdatedAtMs = Number.isFinite(FALLBACK_GENERATED_AT_MS) ? FALLBACK_GENERATED_AT_MS : nowMs;

  const [cryptosResult, stocksResult, etfsResult, currenciesResult, nightResult] = await Promise.all([
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
      key: "stooq:top-stocks",
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
        fetchTopStocksFromStooq({
          timeoutMs,
        }),
    }),
    resolveSegment<DashboardEtf[]>({
      key: "stooq:top-etfs",
      metricKey: "topEtfs",
      label: "topEtfs",
      fallbackValue: FALLBACK_PAYLOAD.topEtfs,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      fetcher: () =>
        fetchTopEtfsFromStooq({
          timeoutMs,
        }),
    }),
    resolveSegment<DashboardCurrency[]>({
      key: "frankfurter:top-currencies",
      metricKey: "topCurrencies",
      label: "topCurrencies",
      fallbackValue: FALLBACK_PAYLOAD.topCurrencies,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      fetcher: () =>
        fetchTopCurrenciesFromFrankfurter({
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
  const topEtfs = normalizeEtfs(etfsResult.data);
  const topCurrencies = normalizeCurrencies(currenciesResult.data);
  const topAssets = buildTopAssets(topStocks, topCryptos);
  const night = normalizeNight(nightResult.data);

  const stale = cryptosResult.stale || stocksResult.stale || etfsResult.stale || currenciesResult.stale || nightResult.stale;
  const fallbackUsed = cryptosResult.fallbackUsed || stocksResult.fallbackUsed || etfsResult.fallbackUsed || currenciesResult.fallbackUsed || nightResult.fallbackUsed;

  const segmentMeta = {
    topCryptos: {
      source: cryptosResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - cryptosResult.updatedAtMs) / 1_000)),
    },
    topStocks: {
      source: stocksResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - stocksResult.updatedAtMs) / 1_000)),
    },
    topEtfs: {
      source: etfsResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - etfsResult.updatedAtMs) / 1_000)),
    },
    topCurrencies: {
      source: currenciesResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - currenciesResult.updatedAtMs) / 1_000)),
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
  for (const segment of SEGMENT_KEYS) {
    const isDegraded = degradedSegments.includes(segment);
    if (isDegraded) {
      if (segmentMeta[segment].ageSec >= staleAlertSec && shouldEmitStaleAlert(segment, staleAlertSec, nowMs)) {
        logger.warn(`[dashboard] stale-threshold segment=${segment} ageSec=${segmentMeta[segment].ageSec} thresholdSec=${staleAlertSec}`);
      }
    } else if (staleAlerts.has(segment)) {
      staleAlerts.delete(segment);
      logger.info(`[dashboard] stale-recovered segment=${segment}`);
    }
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    stale,
    refreshInSec: cacheTtlSec,
    source: {
      equities: "stooq",
      crypto: "coinpaprika",
      fallbackUsed,
    },
    degradedSegments,
    segmentMeta,
    topCryptos,
    topStocks,
    topEtfs,
    topCurrencies,
    topAssets,
    night,
  };
}

export const dashboardFallbackPayload = FALLBACK_PAYLOAD;

import type { DashboardPayload, DashboardSegmentKey, DashboardSegmentSource } from "./types.js";

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "night"];
const SEGMENT_SOURCES = new Set<DashboardSegmentSource>(["live", "fresh-cache", "stale-cache", "fallback", "durable-cache"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function hasBaseEntry(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNumber(value.rank) &&
    isString(value.name) &&
    isString(value.symbol) &&
    isNullableString(value.logoUrl) &&
    isStringArray(value.fallbackLogoUrls)
  );
}

function isCrypto(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    value.category === "Crypto" &&
    isNullableNumber(value.priceUsd) &&
    isNullableNumber(value.marketCapUsd) &&
    isNullableNumber(value.change24h) &&
    (!("sparkline7d" in value) || (Array.isArray(value.sparkline7d) && value.sparkline7d.every(isNumber)))
  );
}

function isStock(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    value.category === "Stock" &&
    isNullableNumber(value.marketCapUsd) &&
    isNullableNumber(value.priceUsd) &&
    isNullableNumber(value.changePercent)
  );
}

function isEtf(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    value.category === "ETF" &&
    isNullableNumber(value.aumUsd) &&
    isNullableNumber(value.priceUsd) &&
    isNullableNumber(value.changePercent)
  );
}

function isCurrency(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    value.category === "Currency" &&
    isNullableNumber(value.rateVsUsd) &&
    isNullableNumber(value.changePercent)
  );
}

function isAsset(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    (value.category === "Stock" || value.category === "Crypto" || value.category === "Commodity") &&
    isNullableNumber(value.marketCapUsd)
  );
}

function isNight(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.symbol) &&
    isNullableString(value.logoUrl) &&
    isStringArray(value.fallbackLogoUrls) &&
    isNullableNumber(value.priceUsd) &&
    isNullableNumber(value.marketCapUsd) &&
    isNullableNumber(value.volume24hUsd) &&
    isNullableNumber(value.athPriceUsd) &&
    isNullableNumber(value.change24h) &&
    isNullableNumber(value.percentFromAth)
  );
}

function hasSegmentMeta(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return SEGMENT_KEYS.every((key) => {
    const meta = value[key];
    return isRecord(meta) && SEGMENT_SOURCES.has(meta.source as DashboardSegmentSource) && isNumber(meta.ageSec);
  });
}

function hasSource(value: unknown): boolean {
  return isRecord(value) && isString(value.equities) && value.crypto === "coinpaprika" && isBoolean(value.fallbackUsed);
}

export function isDashboardPayload(value: unknown): value is DashboardPayload {
  return (
    isRecord(value) &&
    isString(value.generatedAt) &&
    isBoolean(value.stale) &&
    isNumber(value.refreshInSec) &&
    hasSource(value.source) &&
    Array.isArray(value.degradedSegments) &&
    value.degradedSegments.every((segment) => SEGMENT_KEYS.includes(segment as DashboardSegmentKey)) &&
    hasSegmentMeta(value.segmentMeta) &&
    Array.isArray(value.topCryptos) &&
    value.topCryptos.every(isCrypto) &&
    Array.isArray(value.topStocks) &&
    value.topStocks.every(isStock) &&
    Array.isArray(value.topEtfs) &&
    value.topEtfs.every(isEtf) &&
    Array.isArray(value.topCurrencies) &&
    value.topCurrencies.every(isCurrency) &&
    Array.isArray(value.topAssets) &&
    value.topAssets.every(isAsset) &&
    (value.night === null || isNight(value.night)) &&
    (!("requestId" in value) || isString(value.requestId))
  );
}

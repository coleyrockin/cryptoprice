import type { DashboardPayload, DashboardSegmentKey, DashboardSegmentSource } from "./types.js";

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies", "night"];
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

function isAlternateValuation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNumber(value.valueUsd) &&
    isString(value.valueAsOf) &&
    isString(value.sourceUrl) &&
    isString(value.sourceTitle) &&
    (value.sourceType === "rumor" || value.sourceType === "target" || value.sourceType === "secondary-market-chatter") &&
    isString(value.notes)
  );
}

function isAssetValueSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.assetId) &&
    isString(value.category) &&
    isNumber(value.valueUsd) &&
    isString(value.valueAsOf) &&
    isString(value.sourceUrl) &&
    isString(value.sourceTitle) &&
    (value.sourceType === "live-provider" || value.sourceType === "issuer" || value.sourceType === "reported-transaction" || value.sourceType === "recognized-market-data") &&
    (value.confidence === "high" || value.confidence === "medium" || value.confidence === "low" || value.confidence === "curated") &&
    (value.updateCadence === "daily" || value.updateCadence === "weekly" || value.updateCadence === "monthly" || value.updateCadence === "event-driven") &&
    isString(value.notes) &&
    (!("alternateValuations" in value) || (Array.isArray(value.alternateValuations) && value.alternateValuations.every(isAlternateValuation)))
  );
}

function hasValueSources(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isAssetValueSource);
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

function isPrivateCompany(value: unknown): boolean {
  return (
    hasBaseEntry(value) &&
    value.category === "Private Company" &&
    isNullableNumber(value.marketCapUsd)
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
    (value.category === "Stock" || value.category === "Crypto" || value.category === "Commodity" || value.category === "Private Company") &&
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
  return (
    isRecord(value) &&
    isString(value.equities) &&
    value.crypto === "coinpaprika" &&
    isBoolean(value.fallbackUsed) &&
    (!("equityFundamentalsAsOf" in value) || isString(value.equityFundamentalsAsOf)) &&
    (!("valueSourceVersion" in value) || isString(value.valueSourceVersion))
  );
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
    Array.isArray(value.topPrivateCompanies) &&
    value.topPrivateCompanies.every(isPrivateCompany) &&
    Array.isArray(value.topAssets) &&
    value.topAssets.every(isAsset) &&
    (value.night === null || isNight(value.night)) &&
    (!("valueSources" in value) || hasValueSources(value.valueSources)) &&
    (!("requestId" in value) || isString(value.requestId))
  );
}

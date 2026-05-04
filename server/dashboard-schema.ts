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
    Array.isArray(value.topStocks) &&
    Array.isArray(value.topEtfs) &&
    Array.isArray(value.topCurrencies) &&
    Array.isArray(value.topAssets) &&
    (value.night === null || isRecord(value.night))
  );
}

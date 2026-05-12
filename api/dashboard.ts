import { buildDashboardPayload, buildTopAssets } from "../server/dashboard.js";
import { readDurableDashboard, writeDurableDashboard } from "../server/durable-cache.js";
import { envInt } from "../server/env.js";
import { createRequestId, createStructuredLogger, logError, logEvent } from "../server/log.js";
import {
  recordDashboardError,
  recordDashboardRequest,
  recordDurableCacheHit,
  recordDurableCacheWrite,
  recordFallbackServe,
} from "../server/metrics.js";
import type { DashboardPayload, DashboardSegmentKey } from "../server/types.js";

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

function durableSegmentMeta(payload: DashboardPayload, nowMs: number): DashboardPayload["segmentMeta"][DashboardSegmentKey] {
  const ageSec = Math.max(0, Math.floor((nowMs - Date.parse(payload.generatedAt)) / 1_000));
  return {
    source: "durable-cache" as const,
    ageSec: Number.isFinite(ageSec) ? ageSec : 0,
  };
}

const ALL_SEGMENTS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies", "night"];

function fallbackSegments(payload: DashboardPayload): DashboardSegmentKey[] {
  return ALL_SEGMENTS.filter((segment) => payload.segmentMeta[segment].source === "fallback");
}

function mergeDurableFallbackSegments(payload: DashboardPayload, durablePayload: DashboardPayload, nowMs: number): DashboardPayload {
  const segments = fallbackSegments(payload);
  const segmentMeta = { ...payload.segmentMeta };
  const merged: DashboardPayload = {
    ...payload,
    source: {
      ...payload.source,
      fallbackUsed: true,
    },
    stale: true,
    segmentMeta,
  };

  for (const segment of segments) {
    segmentMeta[segment] = durableSegmentMeta(durablePayload, nowMs);
    if (segment === "topCryptos") merged.topCryptos = durablePayload.topCryptos;
    if (segment === "topStocks") merged.topStocks = durablePayload.topStocks;
    if (segment === "topEtfs") merged.topEtfs = durablePayload.topEtfs;
    if (segment === "topCurrencies") merged.topCurrencies = durablePayload.topCurrencies;
    if (segment === "topPrivateCompanies") merged.topPrivateCompanies = durablePayload.topPrivateCompanies;
    if (segment === "night") merged.night = durablePayload.night;
  }

  if (segments.includes("topCryptos") || segments.includes("topStocks")) {
    merged.topAssets = buildTopAssets(merged.topStocks, merged.topCryptos);
  }

  merged.degradedSegments = ALL_SEGMENTS.filter((segment) => {
    const source = segmentMeta[segment].source;
    return source === "stale-cache" || source === "fallback" || source === "durable-cache";
  });

  return merged;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const requestId = createRequestId();
  const logger = createStructuredLogger("api.dashboard", requestId);

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  recordDashboardRequest();
  logEvent("info", "api.dashboard.request", { requestId });

  try {
    const fallbackTtlSec = envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
    const payload = await buildDashboardPayload({ logger });
    let resolvedPayload = payload;

    const fallbackSegmentKeys = fallbackSegments(payload);
    if (fallbackSegmentKeys.length > 0) {
      recordFallbackServe();
      const durablePayload = await readDurableDashboard(fallbackTtlSec);
      if (durablePayload) {
        recordDurableCacheHit();
        resolvedPayload = mergeDurableFallbackSegments(payload, durablePayload, Date.now());
      }
    } else if (!payload.stale) {
      const wroteDurablePayload = await writeDurableDashboard(payload, fallbackTtlSec);
      if (wroteDurablePayload) {
        recordDurableCacheWrite();
      }
    }

    const responsePayload: DashboardPayload = {
      ...resolvedPayload,
      requestId,
    };

    response.setHeader("X-Wap-Request-Id", requestId);
    response.setHeader("X-Wap-Stale", String(resolvedPayload.stale));
    response.setHeader("X-Wap-Fallback", String(resolvedPayload.source.fallbackUsed));
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(responsePayload);
  } catch (error) {
    recordDashboardError();
    logError("api.dashboard.failed", error, { requestId });
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(502).json({
      error: "Failed to build dashboard payload",
      requestId,
    });
  }
}

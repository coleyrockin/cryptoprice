import { buildDashboardPayload } from "../server/dashboard";
import { readDurableDashboard, writeDurableDashboard } from "../server/durable-cache";
import { envInt } from "../server/env";
import { createRequestId, createStructuredLogger, logError, logEvent } from "../server/log";
import {
  recordDashboardError,
  recordDashboardRequest,
  recordDurableCacheHit,
  recordDurableCacheWrite,
  recordFallbackServe,
} from "../server/metrics";
import type { DashboardPayload, DashboardSegmentKey } from "../server/types";

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

function durableSegmentMeta(payload: DashboardPayload, nowMs: number): DashboardPayload["segmentMeta"] {
  const ageSec = Math.max(0, Math.floor((nowMs - Date.parse(payload.generatedAt)) / 1_000));
  return {
    topCryptos: {
      source: "durable-cache",
      ageSec: Number.isFinite(ageSec) ? ageSec : 0,
    },
    topStocks: {
      source: "durable-cache",
      ageSec: Number.isFinite(ageSec) ? ageSec : 0,
    },
    night: {
      source: "durable-cache",
      ageSec: Number.isFinite(ageSec) ? ageSec : 0,
    },
  };
}

const ALL_SEGMENTS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "night"];

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

    if (payload.stale || payload.source.fallbackUsed) {
      recordFallbackServe();
      const durablePayload = await readDurableDashboard(fallbackTtlSec);
      if (durablePayload) {
        recordDurableCacheHit();
        const nowMs = Date.now();
        resolvedPayload = {
          ...durablePayload,
          generatedAt: new Date(nowMs).toISOString(),
          stale: true,
          degradedSegments: ALL_SEGMENTS,
          segmentMeta: durableSegmentMeta(durablePayload, nowMs),
          source: {
            ...durablePayload.source,
            fallbackUsed: true,
          },
        };
      }
    } else {
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

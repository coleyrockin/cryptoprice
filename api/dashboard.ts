import { buildDashboardPayload } from "../server/dashboard";
import { readDurableDashboard, writeDurableDashboard } from "../server/durable-cache";
import {
  recordDashboardError,
  recordDashboardRequest,
  recordDurableCacheHit,
  recordDurableCacheWrite,
  recordFallbackServe,
} from "../server/metrics";

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

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

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  recordDashboardRequest();

  try {
    const fallbackTtlSec = envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
    const payload = await buildDashboardPayload();
    let resolvedPayload = payload;

    if (payload.stale || payload.source.fallbackUsed) {
      recordFallbackServe();
      const durablePayload = await readDurableDashboard(fallbackTtlSec);
      if (durablePayload) {
        recordDurableCacheHit();
        resolvedPayload = {
          ...durablePayload,
          generatedAt: new Date().toISOString(),
          stale: true,
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

    response.setHeader("X-Cryptoprice-Stale", String(resolvedPayload.stale));
    response.setHeader("X-Cryptoprice-Fallback", String(resolvedPayload.source.fallbackUsed));
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(resolvedPayload);
  } catch (error) {
    recordDashboardError();
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[dashboard] request failed reason=${message}`);
    response.status(502).json({
      error: "Failed to build dashboard payload",
    });
  }
}

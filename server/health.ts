import { dashboardFallbackPayload } from "./dashboard.js";
import { isDurableCacheConfigured } from "./durable-cache.js";
import { getMetricsSnapshot } from "./metrics.js";

export type Readiness = "ready" | "degraded" | "down";

function providerCheck(metrics: ReturnType<typeof getMetricsSnapshot>): "ok" | "degraded" {
  const hasCurrentFailures = Object.values(metrics.provider).some((entry) => {
    const lastSuccessMs = timestampMs(entry.lastSuccessAt);
    const lastFailureMs = timestampMs(entry.lastFailureAt);
    const lastFallbackMs = timestampMs(entry.lastFallbackAt);
    return Math.max(lastFailureMs, lastFallbackMs) > lastSuccessMs;
  });
  return hasCurrentFailures ? "degraded" : "ok";
}

function fallbackCheck(metrics: ReturnType<typeof getMetricsSnapshot>): "standby" | "in-use" {
  const latestSuccessMs = Math.max(...Object.values(metrics.provider).map((entry) => timestampMs(entry.lastSuccessAt)));
  const latestFallbackServeMs = timestampMs(metrics.lastFallbackServeAt);
  const providerFallbackActive = Object.values(metrics.provider).some(
    (entry) => timestampMs(entry.lastFallbackAt) > timestampMs(entry.lastSuccessAt),
  );
  return latestFallbackServeMs > latestSuccessMs || providerFallbackActive ? "in-use" : "standby";
}

function cacheCheck(durableConfigured: boolean): "durable+memory" | "memory-only" {
  return durableConfigured ? "durable+memory" : "memory-only";
}

function timestampMs(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildHealthPayload(requestId: string) {
  const metrics = getMetricsSnapshot();
  const durableConfigured = isDurableCacheConfigured();
  const providers = providerCheck(metrics);
  const fallback = fallbackCheck(metrics);

  let readiness: Readiness = "ready";
  if (metrics.dashboardRequests > 0 && metrics.dashboardErrors >= metrics.dashboardRequests) {
    readiness = "down";
  } else if (providers === "degraded" || fallback === "in-use" || metrics.dashboardErrors > 0) {
    readiness = "degraded";
  }

  const fallbackGeneratedAtMs = Date.parse(dashboardFallbackPayload.generatedAt);
  const fallbackAgeSec = Number.isFinite(fallbackGeneratedAtMs)
    ? Math.max(0, Math.floor((Date.now() - fallbackGeneratedAtMs) / 1_000))
    : null;

  const payload = {
    ok: readiness !== "down",
    readiness,
    service: "wap-api",
    requestId,
    timestamp: new Date().toISOString(),
    checks: {
      providers,
      cache: cacheCheck(durableConfigured),
      fallback,
    },
    durableCache: {
      configured: durableConfigured,
    },
    fallbackAgeSec,
  };

  if (process.env.HEALTH_INCLUDE_METRICS === "true") {
    return {
      ...payload,
      providerStatus: metrics.provider,
      metrics,
    };
  }

  return payload;
}

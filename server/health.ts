import { dashboardFallbackPayload } from "./dashboard";
import { isDurableCacheConfigured } from "./durable-cache";
import { getMetricsSnapshot } from "./metrics";

export type Readiness = "ready" | "degraded" | "down";

function providerCheck(metrics: ReturnType<typeof getMetricsSnapshot>): "ok" | "degraded" {
  const hasFailures = Object.values(metrics.provider).some((entry) => entry.failures > 0 || entry.fallbacks > 0);
  return hasFailures ? "degraded" : "ok";
}

function fallbackCheck(metrics: ReturnType<typeof getMetricsSnapshot>): "standby" | "in-use" {
  return metrics.fallbackServes > 0 ? "in-use" : "standby";
}

function cacheCheck(durableConfigured: boolean): "durable+memory" | "memory-only" {
  return durableConfigured ? "durable+memory" : "memory-only";
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

  return {
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
    providerStatus: metrics.provider,
    metrics,
  };
}

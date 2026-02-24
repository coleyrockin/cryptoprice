export type ProviderMetricKey = "topCryptos" | "topStocks" | "night";

type ProviderMetric = {
  requests: number;
  successes: number;
  failures: number;
  fallbacks: number;
  avgLatencyMs: number;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

type MetricsState = {
  startedAt: string;
  dashboardRequests: number;
  dashboardErrors: number;
  fallbackServes: number;
  durableCacheHits: number;
  durableCacheWrites: number;
  logoProxyRequests: number;
  logoProxyErrors: number;
  clientErrors: number;
  provider: Record<ProviderMetricKey, ProviderMetric>;
};

function createProviderMetric(): ProviderMetric {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    fallbacks: 0,
    avgLatencyMs: 0,
    lastLatencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}

function createMetricsState(): MetricsState {
  return {
    startedAt: new Date().toISOString(),
    dashboardRequests: 0,
    dashboardErrors: 0,
    fallbackServes: 0,
    durableCacheHits: 0,
    durableCacheWrites: 0,
    logoProxyRequests: 0,
    logoProxyErrors: 0,
    clientErrors: 0,
    provider: {
      topCryptos: createProviderMetric(),
      topStocks: createProviderMetric(),
      night: createProviderMetric(),
    },
  };
}

type GlobalMetrics = typeof globalThis & {
  __CRYPTOPRICE_METRICS__?: MetricsState;
};

const globalMetrics = globalThis as GlobalMetrics;

const metricsState = globalMetrics.__CRYPTOPRICE_METRICS__ ?? (globalMetrics.__CRYPTOPRICE_METRICS__ = createMetricsState());

export function recordDashboardRequest(): void {
  metricsState.dashboardRequests += 1;
}

export function recordDashboardError(): void {
  metricsState.dashboardErrors += 1;
}

export function recordFallbackServe(): void {
  metricsState.fallbackServes += 1;
}

export function recordDurableCacheHit(): void {
  metricsState.durableCacheHits += 1;
}

export function recordDurableCacheWrite(): void {
  metricsState.durableCacheWrites += 1;
}

export function recordLogoProxyRequest(): void {
  metricsState.logoProxyRequests += 1;
}

export function recordLogoProxyError(): void {
  metricsState.logoProxyErrors += 1;
}

export function recordClientError(): void {
  metricsState.clientErrors += 1;
}

export function recordProviderSuccess(key: ProviderMetricKey, latencyMs: number): void {
  const metric = metricsState.provider[key];
  metric.requests += 1;
  metric.successes += 1;
  metric.lastLatencyMs = Math.max(0, Math.round(latencyMs));
  metric.avgLatencyMs =
    metric.successes === 1
      ? metric.lastLatencyMs
      : Math.round((metric.avgLatencyMs * (metric.successes - 1) + metric.lastLatencyMs) / metric.successes);
  metric.lastSuccessAt = new Date().toISOString();
}

export function recordProviderFailure(key: ProviderMetricKey): void {
  const metric = metricsState.provider[key];
  metric.requests += 1;
  metric.failures += 1;
  metric.lastFailureAt = new Date().toISOString();
}

export function recordProviderFallback(key: ProviderMetricKey): void {
  metricsState.provider[key].fallbacks += 1;
}

export function getMetricsSnapshot() {
  return structuredClone(metricsState);
}

export function resetMetrics(): void {
  const next = createMetricsState();
  metricsState.startedAt = next.startedAt;
  metricsState.dashboardRequests = next.dashboardRequests;
  metricsState.dashboardErrors = next.dashboardErrors;
  metricsState.fallbackServes = next.fallbackServes;
  metricsState.durableCacheHits = next.durableCacheHits;
  metricsState.durableCacheWrites = next.durableCacheWrites;
  metricsState.logoProxyRequests = next.logoProxyRequests;
  metricsState.logoProxyErrors = next.logoProxyErrors;
  metricsState.clientErrors = next.clientErrors;
  metricsState.provider = next.provider;
}

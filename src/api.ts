import type { DashboardPayload } from "./types/dashboard";

declare const __GITHUB_PAGES__: boolean;

const DASHBOARD_ENDPOINT = import.meta.env.DEV
  ? "/__local_api/dashboard"
  : __GITHUB_PAGES__
    ? import.meta.env.BASE_URL + "data/dashboard.json"
    : "/api/dashboard";

const CLIENT_ERROR_ENDPOINT = import.meta.env.DEV ? "/__local_api/client-error" : "/api/client-error";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function normalizeDashboardPayload(payload: DashboardPayload): DashboardPayload {
  const generatedAtMs = Date.parse(payload.generatedAt);
  const ageSec = Number.isFinite(generatedAtMs) ? Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1_000)) : 0;

  return {
    ...payload,
    refreshInSec: Number.isFinite(payload.refreshInSec) ? payload.refreshInSec : 30,
    degradedSegments: Array.isArray(payload.degradedSegments) ? payload.degradedSegments : [],
    segmentMeta: payload.segmentMeta ?? {
      topCryptos: {
        source: "fallback",
        ageSec,
      },
      topStocks: {
        source: "fallback",
        ageSec,
      },
      night: {
        source: "fallback",
        ageSec,
      },
      topCurrencies: {
        source: "fallback",
        ageSec,
      },
    },
    topCryptos: Array.isArray(payload.topCryptos) ? payload.topCryptos : [],
    topStocks: Array.isArray(payload.topStocks) ? payload.topStocks : [],
    topAssets: Array.isArray(payload.topAssets) ? payload.topAssets : [],
    topCurrencies: Array.isArray(payload.topCurrencies) ? payload.topCurrencies : [],
    night: payload.night ?? null,
  };
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const payload = await getJson<DashboardPayload>(DASHBOARD_ENDPOINT);
  return normalizeDashboardPayload(payload);
}

type ClientErrorPayload = {
  message: string;
  source?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
};

export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
  if (!import.meta.env.PROD) {
    return;
  }

  try {
    await fetch(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Fire-and-forget client telemetry.
  }
}

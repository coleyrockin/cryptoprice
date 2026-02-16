import type { DashboardPayload } from "./types/dashboard";

const DASHBOARD_ENDPOINT = import.meta.env.DEV ? "/__local_api/dashboard" : "/api/dashboard";

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
  return {
    ...payload,
    refreshInSec: Number.isFinite(payload.refreshInSec) ? payload.refreshInSec : 60,
    topCryptos: Array.isArray(payload.topCryptos) ? payload.topCryptos : [],
    topStocks: Array.isArray(payload.topStocks) ? payload.topStocks : [],
    topAssets: Array.isArray(payload.topAssets) ? payload.topAssets : [],
    night: payload.night ?? null,
  };
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const payload = await getJson<DashboardPayload>(DASHBOARD_ENDPOINT);
  return normalizeDashboardPayload(payload);
}

import type { DashboardPayload, DashboardSegmentKey, DashboardSegmentSource } from "./types/dashboard";

declare const __GITHUB_PAGES__: boolean;

const DASHBOARD_ENDPOINT = import.meta.env.DEV
  ? "/__local_api/dashboard"
  : __GITHUB_PAGES__
    ? import.meta.env.BASE_URL + "data/dashboard.json"
    : "/api/dashboard";

const CLIENT_ERROR_ENDPOINT = import.meta.env.DEV ? "/__local_api/client-error" : "/api/client-error";
const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies", "night"];
const SEGMENT_SOURCES = new Set<DashboardSegmentSource>(["live", "fresh-cache", "stale-cache", "fallback", "durable-cache"]);

function isSegmentSource(value: unknown): value is DashboardSegmentSource {
  return typeof value === "string" && SEGMENT_SOURCES.has(value as DashboardSegmentSource);
}

function isDegradedSource(source: DashboardSegmentSource): boolean {
  return source === "stale-cache" || source === "fallback" || source === "durable-cache";
}

function normalizeSegmentMeta(payload: DashboardPayload, ageSec: number): DashboardPayload["segmentMeta"] {
  const segmentMeta = payload.segmentMeta as Partial<
    Record<DashboardSegmentKey, Partial<DashboardPayload["segmentMeta"][DashboardSegmentKey]>>
  > | undefined;

  return Object.fromEntries(
    SEGMENT_KEYS.map((segment) => {
      const meta = segmentMeta?.[segment];
      const metaAgeSec = typeof meta?.ageSec === "number" && Number.isFinite(meta.ageSec) ? Math.max(0, Math.floor(meta.ageSec)) : ageSec;
      return [
        segment,
        {
          source: isSegmentSource(meta?.source) ? meta.source : "fallback",
          ageSec: metaAgeSec,
        },
      ];
    }),
  ) as DashboardPayload["segmentMeta"];
}

function deriveDegradedSegments(segmentMeta: DashboardPayload["segmentMeta"]): DashboardSegmentKey[] {
  return SEGMENT_KEYS.filter((segment) => isDegradedSource(segmentMeta[segment].source));
}

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
  const segmentMeta = normalizeSegmentMeta(payload, ageSec);

  return {
    ...payload,
    refreshInSec: Number.isFinite(payload.refreshInSec) ? payload.refreshInSec : 30,
    degradedSegments: deriveDegradedSegments(segmentMeta),
    segmentMeta,
    topCryptos: Array.isArray(payload.topCryptos) ? payload.topCryptos : [],
    topStocks: Array.isArray(payload.topStocks) ? payload.topStocks : [],
    topEtfs: Array.isArray(payload.topEtfs) ? payload.topEtfs : [],
    topCurrencies: Array.isArray(payload.topCurrencies) ? payload.topCurrencies : [],
    topPrivateCompanies: Array.isArray(payload.topPrivateCompanies) ? payload.topPrivateCompanies : [],
    topAssets: Array.isArray(payload.topAssets) ? payload.topAssets : [],
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

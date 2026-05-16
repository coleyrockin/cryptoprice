import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAssetDetail, fetchDashboard } from "./api";
import type { AssetDetailPayload, DashboardPayload, DashboardSegmentKey } from "./types/dashboard";

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies", "night"];

function basePayload(): DashboardPayload {
  return {
    generatedAt: "2026-05-12T00:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: {
      equities: "stooq",
      crypto: "coinpaprika",
      fallbackUsed: false,
      equityFundamentalsAsOf: "2026-05-12",
    },
    degradedSegments: [],
    segmentMeta: {
      topCryptos: { source: "live", ageSec: 0 },
      topStocks: { source: "live", ageSec: 0 },
      topEtfs: { source: "live", ageSec: 0 },
      topCurrencies: { source: "live", ageSec: 0 },
      topPrivateCompanies: { source: "live", ageSec: 0 },
      night: { source: "live", ageSec: 0 },
    },
    topCryptos: [],
    topStocks: [],
    topEtfs: [],
    topCurrencies: [],
    topPrivateCompanies: [],
    topAssets: [],
    night: null,
  };
}

function mockFetchPayload(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    ),
  );
}

describe("fetchDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives degraded segments from segment metadata", async () => {
    const payload = basePayload();
    payload.segmentMeta.topStocks = { source: "stale-cache", ageSec: 90 };
    payload.degradedSegments = [];
    mockFetchPayload(payload);

    const dashboard = await fetchDashboard();

    expect(dashboard.degradedSegments).toEqual(["topStocks"]);
    expect(dashboard.segmentMeta.topStocks.source).toBe("stale-cache");
  });

  it("defaults old payloads without segment metadata to fallback health", async () => {
    const payload = {
      ...basePayload(),
      degradedSegments: undefined,
      segmentMeta: undefined,
    };
    mockFetchPayload(payload);

    const dashboard = await fetchDashboard();

    expect(dashboard.degradedSegments).toEqual(SEGMENT_KEYS);
    expect(dashboard.segmentMeta.topPrivateCompanies.source).toBe("fallback");
  });
});

describe("fetchAssetDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests an additive asset detail endpoint", async () => {
    const detail: AssetDetailPayload = {
      asset: {
        id: "stock-nvda",
        symbol: "NVDA",
        displayName: "NVIDIA",
        category: "Stock",
        currency: "USD",
        tradable: true,
        supportsHistory: true,
        supportsLivePrice: true,
        providerIds: { stooq: "NVDA" },
      },
      quote: {
        valueUsd: 1,
        priceUsd: 1,
        valueLabel: "Estimated market cap",
        asOf: "2026-05-13T00:00:00.000Z",
      },
      history: {
        range: "30D",
        available: false,
        points: [],
        reason: "unavailable",
      },
      provenance: {
        provider: "Stooq / Yahoo Finance fallback",
        source: "live",
        segment: "topStocks",
        ageSec: 0,
        updatedAt: "2026-05-13T00:00:00.000Z",
        valueMethod: "derived-market-cap",
        confidence: "medium",
        limitation: "Estimated",
      },
      stale: false,
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAssetDetail("stock-nvda", "30D")).resolves.toEqual(detail);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/asset-detail?id=stock-nvda&range=30D");
  });
});

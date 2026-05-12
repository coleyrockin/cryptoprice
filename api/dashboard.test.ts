import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/dashboard", () => ({
  buildDashboardPayload: vi.fn(),
  buildTopAssets: vi.fn((stocks, cryptos) => [...stocks, ...cryptos]),
}));

vi.mock("../server/durable-cache", () => ({
  readDurableDashboard: vi.fn(),
  writeDurableDashboard: vi.fn(),
}));

import handler from "./dashboard";
import { createMockResponse } from "./test-utils";
import { buildDashboardPayload } from "../server/dashboard";
import { readDurableDashboard, writeDurableDashboard } from "../server/durable-cache";
import type { DashboardPayload } from "../server/types";

const mockedBuildDashboardPayload = vi.mocked(buildDashboardPayload);
const mockedReadDurableDashboard = vi.mocked(readDurableDashboard);
const mockedWriteDurableDashboard = vi.mocked(writeDurableDashboard);

function cryptoEntry(id: string, symbol: string): DashboardPayload["topCryptos"][number] {
  return {
    id,
    rank: 1,
    name: symbol,
    symbol,
    category: "Crypto",
    priceUsd: 100,
    marketCapUsd: 1000,
    change24h: 1,
    sparkline7d: [0, 1],
    logoUrl: null,
    fallbackLogoUrls: [],
  };
}

function stockEntry(id: string, symbol: string): DashboardPayload["topStocks"][number] {
  return {
    id,
    rank: 1,
    name: symbol,
    symbol,
    category: "Stock",
    marketCapUsd: 1000,
    priceUsd: 100,
    changePercent: 1,
    logoUrl: null,
    fallbackLogoUrls: [],
  };
}

function samplePayload(): DashboardPayload {
  return {
    generatedAt: "2026-02-24T00:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: {
      equities: "stooq",
      crypto: "coinpaprika",
      fallbackUsed: false,
      equityFundamentalsAsOf: "2026-05-11",
    },
    degradedSegments: [],
    segmentMeta: {
      topCryptos: {
        source: "live",
        ageSec: 0,
      },
      topStocks: {
        source: "live",
        ageSec: 0,
      },
      topEtfs: {
        source: "live",
        ageSec: 0,
      },
      topCurrencies: {
        source: "live",
        ageSec: 0,
      },
      topPrivateCompanies: {
        source: "live",
        ageSec: 0,
      },
      night: {
        source: "live",
        ageSec: 0,
      },
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

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    mockedBuildDashboardPayload.mockReset();
    mockedReadDurableDashboard.mockReset();
    mockedWriteDurableDashboard.mockReset();
  });

  it("returns 405 for non-GET requests", async () => {
    const { response, state } = createMockResponse();

    await handler({ method: "POST" }, response);

    expect(state.statusCode).toBe(405);
    expect(state.headers["allow"]).toBe("GET");
  });

  it("returns normalized payload with request id", async () => {
    mockedBuildDashboardPayload.mockResolvedValue(samplePayload());
    mockedWriteDurableDashboard.mockResolvedValue(true);

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    expect(state.headers["x-wap-request-id"]).toBeTruthy();

    const body = state.jsonBody as DashboardPayload;
    expect(body.requestId).toBeTruthy();
    expect(body.segmentMeta.topCryptos.source).toBe("live");
    expect(body.degradedSegments).toEqual([]);
  });

  it("returns stale and fallback headers when source is fallback", async () => {
    const stalePayload = samplePayload();
    stalePayload.stale = true;
    stalePayload.source.fallbackUsed = true;
    stalePayload.degradedSegments = ["topStocks"];
    stalePayload.segmentMeta.topStocks.source = "fallback";

    mockedBuildDashboardPayload.mockResolvedValue(stalePayload);
    mockedWriteDurableDashboard.mockResolvedValue(false);

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    expect(state.headers["x-wap-stale"]).toBe("true");
    expect(state.headers["x-wap-fallback"]).toBe("true");
    const body = state.jsonBody as DashboardPayload;
    expect(body.degradedSegments).toEqual(["topStocks"]);
    expect(body.segmentMeta.topStocks.source).toBe("fallback");
  });

  it("returns stale header without fallback when using stale-cache entries", async () => {
    const stalePayload = samplePayload();
    stalePayload.stale = true;
    stalePayload.source.fallbackUsed = false;
    stalePayload.degradedSegments = ["topEtfs"];
    stalePayload.segmentMeta.topEtfs.source = "stale-cache";

    mockedBuildDashboardPayload.mockResolvedValue(stalePayload);

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    expect(state.headers["x-wap-stale"]).toBe("true");
    expect(state.headers["x-wap-fallback"]).toBe("false");
    const body = state.jsonBody as DashboardPayload;
    expect(body.degradedSegments).toEqual(["topEtfs"]);
    expect(body.segmentMeta.topEtfs.source).toBe("stale-cache");
  });

  it("uses durable payload for fallback segments", async () => {
    const stale = samplePayload();
    stale.stale = true;
    stale.source.fallbackUsed = true;
    stale.degradedSegments = ["topCryptos"];
    stale.segmentMeta.topCryptos.source = "fallback";
    stale.segmentMeta.topCryptos.ageSec = 500;

    mockedBuildDashboardPayload.mockResolvedValue(stale);

    const durable = samplePayload();
    durable.generatedAt = "2026-02-24T00:00:00.000Z";
    mockedReadDurableDashboard.mockResolvedValue(durable);

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    const body = state.jsonBody as DashboardPayload;
    expect(body.stale).toBe(true);
    expect(body.source.fallbackUsed).toBe(true);
    expect(body.degradedSegments).toEqual(["topCryptos"]);
    expect(body.segmentMeta.topCryptos.source).toBe("durable-cache");
    expect(body.segmentMeta.topStocks.source).toBe("live");
  });

  it("fills only fallback segments from durable cache", async () => {
    const partial = samplePayload();
    partial.stale = true;
    partial.source.fallbackUsed = true;
    partial.degradedSegments = ["topStocks"];
    partial.segmentMeta.topStocks.source = "fallback";
    partial.segmentMeta.topStocks.ageSec = 500;
    partial.topCryptos = [cryptoEntry("live-btc", "BTC")];
    partial.topStocks = [stockEntry("fallback-stock", "OLD")];

    mockedBuildDashboardPayload.mockResolvedValue(partial);

    const durable = samplePayload();
    durable.topCryptos = [cryptoEntry("durable-eth", "ETH")];
    durable.topStocks = [stockEntry("durable-aapl", "AAPL")];
    mockedReadDurableDashboard.mockResolvedValue(durable);

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    const body = state.jsonBody as DashboardPayload;
    expect(body.topCryptos[0]?.id).toBe("live-btc");
    expect(body.topStocks[0]?.id).toBe("durable-aapl");
    expect(body.degradedSegments).toEqual(["topStocks"]);
    expect(body.segmentMeta.topCryptos.source).toBe("live");
    expect(body.segmentMeta.topStocks.source).toBe("durable-cache");
  });

  it("does not consult durable cache for stale-cache-only responses", async () => {
    const staleCache = samplePayload();
    staleCache.stale = true;
    staleCache.source.fallbackUsed = false;
    staleCache.degradedSegments = ["topStocks"];
    staleCache.segmentMeta.topStocks.source = "stale-cache";
    staleCache.segmentMeta.topStocks.ageSec = 90;
    staleCache.topStocks = [stockEntry("stale-cache-aapl", "AAPL")];

    mockedBuildDashboardPayload.mockResolvedValue(staleCache);
    mockedReadDurableDashboard.mockResolvedValue(samplePayload());

    const { response, state } = createMockResponse();
    await handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    expect(mockedReadDurableDashboard).not.toHaveBeenCalled();
    const body = state.jsonBody as DashboardPayload;
    expect(body.topStocks[0]?.id).toBe("stale-cache-aapl");
    expect(body.segmentMeta.topStocks.source).toBe("stale-cache");
  });
});

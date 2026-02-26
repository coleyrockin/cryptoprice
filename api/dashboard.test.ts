/* eslint-disable import/order */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/dashboard", () => ({
  buildDashboardPayload: vi.fn(),
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

function samplePayload(): DashboardPayload {
  return {
    generatedAt: "2026-02-24T00:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: {
      equities: "fmp",
      crypto: "coinpaprika",
      fallbackUsed: false,
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
      night: {
        source: "live",
        ageSec: 0,
      },
    },
    topCryptos: [],
    topStocks: [],
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

  it("uses durable payload when live response is stale", async () => {
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
    expect(body.degradedSegments).toEqual(["topCryptos", "topStocks", "night"]);
    expect(body.segmentMeta.topStocks.source).toBe("durable-cache");
  });
});

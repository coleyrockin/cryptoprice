import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/asset-detail", () => ({
  buildAssetDetailPayload: vi.fn(),
}));

import handler from "./asset-detail";
import { createMockResponse } from "./test-utils";
import { buildAssetDetailPayload } from "../server/asset-detail";
import type { AssetDetailPayload } from "../server/types";

const mockedBuildAssetDetailPayload = vi.mocked(buildAssetDetailPayload);

function sampleDetail(): AssetDetailPayload {
  return {
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
      valueUsd: 5_300_000_000_000,
      priceUsd: 220,
      valueLabel: "Estimated market cap",
      changePercent: 1,
      asOf: "2026-05-13T00:00:00.000Z",
    },
    history: {
      range: "30D",
      available: true,
      points: [{ t: "2026-05-01T00:00:00.000Z", value: 200 }],
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
}

describe("GET /api/asset-detail", () => {
  beforeEach(() => {
    mockedBuildAssetDetailPayload.mockReset();
  });

  it("returns 405 for non-GET requests", async () => {
    const { response, state } = createMockResponse();
    await handler({ method: "POST" }, response);

    expect(state.statusCode).toBe(405);
    expect(state.headers["allow"]).toBe("GET");
  });

  it("requires an asset id", async () => {
    const { response, state } = createMockResponse();
    await handler({ method: "GET", query: {} }, response);

    expect(state.statusCode).toBe(400);
    expect(mockedBuildAssetDetailPayload).not.toHaveBeenCalled();
  });

  it("rejects unsupported ranges", async () => {
    const { response, state } = createMockResponse();
    await handler({ method: "GET", query: { id: "stock-nvda", range: "1D" } }, response);

    expect(state.statusCode).toBe(400);
    expect(mockedBuildAssetDetailPayload).not.toHaveBeenCalled();
  });

  it("returns detail payload with request id", async () => {
    mockedBuildAssetDetailPayload.mockResolvedValue(sampleDetail());
    const { response, state } = createMockResponse();

    await handler({ method: "GET", query: { id: "stock-nvda", range: "30D" } }, response);

    expect(state.statusCode).toBe(200);
    expect(mockedBuildAssetDetailPayload).toHaveBeenCalledWith({ id: "stock-nvda", range: "30D" });
    expect((state.jsonBody as AssetDetailPayload).requestId).toBeTruthy();
  });

  it("returns 404 for unknown assets", async () => {
    mockedBuildAssetDetailPayload.mockRejectedValue(new Error("unknown_asset"));
    const { response, state } = createMockResponse();

    await handler({ method: "GET", query: { id: "stock-missing", range: "30D" } }, response);

    expect(state.statusCode).toBe(404);
  });
});

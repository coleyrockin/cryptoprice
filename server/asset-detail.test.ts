import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAssetDetailPayload } from "./asset-detail";
import type { DashboardPayload } from "./types";

function stockPayload(): DashboardPayload {
  return {
    generatedAt: "2026-05-13T00:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: { equities: "stooq", crypto: "coinpaprika", fallbackUsed: false, equityFundamentalsAsOf: "2026-05-12" },
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
    topStocks: [{
      id: "stock-nvda",
      rank: 1,
      name: "NVIDIA",
      symbol: "NVDA",
      category: "Stock",
      marketCapUsd: 5_300_000_000_000,
      priceUsd: 220,
      changePercent: 1.5,
      logoUrl: null,
      fallbackLogoUrls: [],
    }],
    topEtfs: [],
    topCurrencies: [],
    topPrivateCompanies: [{
      id: "private-spacex",
      rank: 1,
      name: "SpaceX",
      symbol: "SPACEX",
      category: "Private Company",
      marketCapUsd: 1_250_000_000_000,
      logoUrl: null,
      fallbackLogoUrls: [],
    }],
    topAssets: [],
    night: null,
  };
}

describe("buildAssetDetailPayload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns stock detail with derived valuation provenance and honest unavailable history", async () => {
    const detail = await buildAssetDetailPayload({
      id: "stock-nvda",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(detail.asset.providerIds.stooq).toBe("NVDA");
    expect(detail.asset.supportsHistory).toBe(false);
    expect(detail.history.available).toBe(false);
    expect(detail.history.reason).toContain("no-key stock and ETF history provider");
    expect(detail.provenance.valueMethod).toBe("derived-market-cap");
    expect(detail.provenance.confidence).toBe("high");
    expect(detail.provenance.sourceTitle).toContain("NVIDIA");
  });

  it("labels private companies as curated with unsupported history", async () => {
    const detail = await buildAssetDetailPayload({
      id: "private-spacex",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(detail.provenance.source).toBe("curated");
    expect(detail.provenance.confidence).toBe("high");
    expect(detail.provenance.alternateValuations?.[0]?.sourceType).toBe("target");
    expect(detail.history.available).toBe(false);
    expect(detail.history.reason).toContain("curated");
  });

  it("rejects unknown assets before building detail", async () => {
    await expect(
      buildAssetDetailPayload({
        id: "missing",
        range: "30D",
        dashboard: stockPayload(),
      }),
    ).rejects.toThrow("unknown_asset");
  });
});

import { describe, expect, it } from "vitest";

import { buildPortfolioSummary, parsePositiveDecimal, parseStoredHoldings } from "./portfolio";
import type { DashboardStock, LocalHolding } from "../types/dashboard";

const apple: DashboardStock = {
  id: "stock-aapl",
  rank: 1,
  name: "Apple",
  symbol: "AAPL",
  category: "Stock",
  priceUsd: 200,
  marketCapUsd: 3_000_000_000_000,
  changePercent: 1,
  logoUrl: null,
  fallbackLogoUrls: [],
};

describe("portfolio helpers", () => {
  it("parses positive decimal quantities only", () => {
    expect(parsePositiveDecimal("1.25")).toBe(1.25);
    expect(parsePositiveDecimal("0")).toBeNull();
    expect(parsePositiveDecimal("-1")).toBeNull();
    expect(parsePositiveDecimal("1e4")).toBeNull();
  });

  it("drops malformed stored holdings", () => {
    const valid: LocalHolding = {
      assetId: "stock-aapl",
      quantity: "2",
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    };

    expect(parseStoredHoldings(JSON.stringify([valid, { assetId: "bad", quantity: "-1" }]))).toEqual([valid]);
    expect(parseStoredHoldings("not json")).toEqual([]);
  });

  it("calculates value, allocation, and gain loss without requiring a server", () => {
    const holdings: LocalHolding[] = [{
      assetId: "stock-aapl",
      quantity: "2",
      costBasisUsd: "350",
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    }];

    const summary = buildPortfolioSummary(holdings, new Map([["stock-aapl", apple]]));

    expect(summary.totalValueUsd).toBe(400);
    expect(summary.totalGainLossUsd).toBe(50);
    expect(summary.positions[0]?.allocationPercent).toBe(100);
  });
});

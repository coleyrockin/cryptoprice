import { describe, expect, it } from "vitest";

import { fallbackAssetRefs, getFallbackAssetRef, isHistoricalRange } from "./asset-registry";

describe("asset registry", () => {
  it("keeps stable dashboard ids and capability flags", () => {
    const nvda = getFallbackAssetRef("stock-nvda");
    const spacex = getFallbackAssetRef("private-spacex");

    expect(nvda).toMatchObject({
      id: "stock-nvda",
      symbol: "NVDA",
      tradable: true,
      supportsHistory: true,
      providerIds: {
        stooq: "NVDA",
      },
    });
    expect(spacex).toMatchObject({
      id: "private-spacex",
      tradable: false,
      supportsHistory: false,
    });
    expect(fallbackAssetRefs().length).toBeGreaterThan(40);
  });

  it("validates supported historical ranges", () => {
    expect(isHistoricalRange("7D")).toBe(true);
    expect(isHistoricalRange("30D")).toBe(true);
    expect(isHistoricalRange("1Y")).toBe(true);
    expect(isHistoricalRange("1D")).toBe(false);
    expect(isHistoricalRange("ALL")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { normalizeFmpStock, normalizeFmpStocks } from "./fmp";

describe("FMP provider normalization", () => {
  it("maps stock payload into normalized dashboard schema", () => {
    const stocks = normalizeFmpStocks([
      {
        symbol: "AAPL",
        companyName: "Apple",
        marketCap: "3400000000000",
        price: "210.12",
        changesPercentage: "(+1.25%)",
        image: "https://img.example/aapl.png",
      },
    ]);

    expect(stocks).toHaveLength(1);
    expect(stocks[0]).toMatchObject({
      symbol: "AAPL",
      name: "Apple",
      category: "Stock",
      marketCapUsd: 3400000000000,
      priceUsd: 210.12,
      changePercent: 1.25,
      logoUrl: "https://img.example/aapl.png",
    });
    expect(stocks[0].fallbackLogoUrls.length).toBeGreaterThan(0);
  });

  it("normalizes invalid numeric values to null", () => {
    const stock = normalizeFmpStock(
      {
        symbol: "TEST",
        companyName: "Test Corp",
        marketCap: "not-a-number",
        price: Infinity,
        changesPercentage: "(abc)",
      },
      1,
    );

    expect(stock).not.toBeNull();
    expect(stock?.marketCapUsd).toBeNull();
    expect(stock?.priceUsd).toBeNull();
    expect(stock?.changePercent).toBeNull();
  });
});


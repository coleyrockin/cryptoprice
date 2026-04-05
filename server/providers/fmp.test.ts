import { describe, expect, it } from "vitest";

import { normalizeFmpCurrencies, normalizeFmpStock, normalizeFmpStocks } from "./fmp";

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

describe("FMP forex normalization", () => {
  const sampleForexPayload = [
    { symbol: "EURUSD", price: 1.085, changesPercentage: -0.12 },
    { symbol: "USDJPY", price: 153.5, changesPercentage: 0.25 },
    { symbol: "GBPUSD", price: 1.265, changesPercentage: 0.08 },
    { symbol: "AUDUSD", price: 0.645, changesPercentage: -0.05 },
    { symbol: "USDCAD", price: 1.365, changesPercentage: 0.1 },
    { symbol: "USDCHF", price: 0.895, changesPercentage: -0.07 },
    { symbol: "USDCNY", price: 7.24, changesPercentage: 0.03 },
    { symbol: "USDHKD", price: 7.82, changesPercentage: 0.01 },
    { symbol: "NZDUSD", price: 0.595, changesPercentage: -0.09 },
  ];

  it("always places USD first with rateVsUsd=1 and changePercent=0", () => {
    const result = normalizeFmpCurrencies(sampleForexPayload);
    expect(result[0]).toMatchObject({
      id: "currency-usd",
      rank: 1,
      symbol: "USD",
      name: "US Dollar",
      category: "Currency",
      rateVsUsd: 1,
      changePercent: 0,
    });
  });

  it("maps a direct USD pair (EURUSD) to rateVsUsd = price", () => {
    const result = normalizeFmpCurrencies(sampleForexPayload);
    const eur = result.find((c) => c.symbol === "EUR");
    expect(eur).toBeDefined();
    expect(eur?.rateVsUsd).toBeCloseTo(1.085, 4);
    expect(eur?.changePercent).toBeCloseTo(-0.12, 4);
  });

  it("maps an inverse USD pair (USDJPY) to rateVsUsd = 1/price and negates changePercent", () => {
    const result = normalizeFmpCurrencies(sampleForexPayload);
    const jpy = result.find((c) => c.symbol === "JPY");
    expect(jpy).toBeDefined();
    expect(jpy?.rateVsUsd).toBeCloseTo(1 / 153.5, 8);
    expect(jpy?.changePercent).toBeCloseTo(-0.25, 4);
  });

  it("sets rateVsUsd=null for a currency whose pair is missing from the payload", () => {
    const result = normalizeFmpCurrencies([]);
    const eur = result.find((c) => c.symbol === "EUR");
    expect(eur?.rateVsUsd).toBeNull();
    expect(eur?.changePercent).toBeNull();
  });

  it("returns exactly 10 entries regardless of payload size", () => {
    expect(normalizeFmpCurrencies(sampleForexPayload)).toHaveLength(10);
    expect(normalizeFmpCurrencies([])).toHaveLength(10);
    expect(normalizeFmpCurrencies(null)).toHaveLength(10);
  });

  it("uses flagcdn.com logo URLs", () => {
    const result = normalizeFmpCurrencies(sampleForexPayload);
    expect(result[0].logoUrl).toBe("https://flagcdn.com/w40/us.png");
    expect(result[0].fallbackLogoUrls).toEqual(["https://flagcdn.com/w80/us.png"]);
    const eur = result.find((c) => c.symbol === "EUR");
    expect(eur?.logoUrl).toBe("https://flagcdn.com/w40/eu.png");
  });

  it("normalizes invalid numeric price to null rateVsUsd", () => {
    const result = normalizeFmpCurrencies([
      { symbol: "EURUSD", price: "not-a-number", changesPercentage: "abc" },
    ]);
    const eur = result.find((c) => c.symbol === "EUR");
    expect(eur?.rateVsUsd).toBeNull();
    expect(eur?.changePercent).toBeNull();
  });
});

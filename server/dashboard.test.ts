import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

vi.mock("./providers/stooq", () => ({
  fetchTopStocksFromStooq: vi.fn(),
  fetchTopEtfsFromStooq: vi.fn(),
}));

vi.mock("./providers/frankfurter", () => ({
  fetchTopCurrenciesFromFrankfurter: vi.fn(),
}));

vi.mock("./providers/coinpaprika", () => ({
  fetchTopCryptosFromCoinpaprika: vi.fn(),
  fetchNightFromCoinpaprika: vi.fn(),
}));

import { buildDashboardPayload, dashboardFallbackPayload } from "./dashboard";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopCurrenciesFromFrankfurter } from "./providers/frankfurter";
import { fetchTopEtfsFromStooq, fetchTopStocksFromStooq } from "./providers/stooq";
import type { DashboardCrypto, DashboardCurrency, DashboardEtf, DashboardNight, DashboardStock } from "./types";

const mockedFetchTopStocksFromStooq = vi.mocked(fetchTopStocksFromStooq);
const mockedFetchTopCryptosFromCoinpaprika = vi.mocked(fetchTopCryptosFromCoinpaprika);
const mockedFetchNightFromCoinpaprika = vi.mocked(fetchNightFromCoinpaprika);
const mockedFetchTopEtfsFromStooq = vi.mocked(fetchTopEtfsFromStooq);
const mockedFetchTopCurrenciesFromFrankfurter = vi.mocked(fetchTopCurrenciesFromFrankfurter);

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const sampleStocks: DashboardStock[] = [
  {
    id: "stock-aapl",
    rank: 1,
    name: "Apple",
    symbol: "AAPL",
    category: "Stock",
    marketCapUsd: 3400000000000,
    priceUsd: 210,
    changePercent: 0.4,
    logoUrl: "https://financialmodelingprep.com/image-stock/AAPL.png",
    fallbackLogoUrls: [],
  },
];

const sampleCryptos: DashboardCrypto[] = [
  {
    id: "btc-bitcoin",
    rank: 1,
    name: "Bitcoin",
    symbol: "BTC",
    category: "Crypto",
    priceUsd: 67000,
    marketCapUsd: 1300000000000,
    change24h: 1.1,
    sparkline7d: [0, 0.2, 0.6, 1.1, 2.1, 4.2],
    logoUrl: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png",
    fallbackLogoUrls: [],
  },
];

const sampleEtfs: DashboardEtf[] = [
  {
    id: "etf-spy",
    rank: 1,
    name: "SPDR S&P 500 ETF Trust",
    symbol: "SPY",
    category: "ETF",
    aumUsd: 585000000000,
    priceUsd: 528.45,
    changePercent: 0.21,
    logoUrl: "https://financialmodelingprep.com/image-stock/SPY.png",
    fallbackLogoUrls: [],
  },
  {
    id: "etf-ivv",
    rank: 2,
    name: "iShares Core S&P 500 ETF",
    symbol: "IVV",
    category: "ETF",
    aumUsd: 510000000000,
    priceUsd: 530.12,
    changePercent: 0.18,
    logoUrl: "https://financialmodelingprep.com/image-stock/IVV.png",
    fallbackLogoUrls: [],
  },
];

const sampleCurrencies: DashboardCurrency[] = [
  {
    id: "currency-usd",
    rank: 1,
    name: "US Dollar",
    symbol: "USD",
    category: "Currency",
    rateVsUsd: 1,
    changePercent: 0,
    logoUrl: "https://flagcdn.com/w40/us.png",
    fallbackLogoUrls: ["https://flagcdn.com/w80/us.png"],
  },
  {
    id: "currency-eur",
    rank: 2,
    name: "Euro",
    symbol: "EUR",
    category: "Currency",
    rateVsUsd: 1.13,
    changePercent: 0.2,
    logoUrl: "https://flagcdn.com/w40/eu.png",
    fallbackLogoUrls: ["https://flagcdn.com/w80/eu.png"],
  },
];

const sampleNight: DashboardNight = {
  id: "night-midnight2",
  name: "Midnight",
  symbol: "NIGHT",
  logoUrl: "https://static.coinpaprika.com/coin/night-midnight2/logo.png",
  fallbackLogoUrls: [],
  priceUsd: 0.84,
  marketCapUsd: 123000000,
  volume24hUsd: 5100000,
  athPriceUsd: 1.22,
  change24h: 3.1,
  percentFromAth: -31.1,
};

describe("buildDashboardPayload", () => {
  beforeEach(() => {
    mockedFetchTopStocksFromStooq.mockReset();
    mockedFetchTopCryptosFromCoinpaprika.mockReset();
    mockedFetchNightFromCoinpaprika.mockReset();
    mockedFetchTopEtfsFromStooq.mockReset();
    mockedFetchTopCurrenciesFromFrankfurter.mockReset();
  });

  it("returns fresh cache entries within TTL without refetching providers", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    now += 30_000;

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(mockedFetchTopStocksFromStooq).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopCryptosFromCoinpaprika).toHaveBeenCalledTimes(1);
    expect(mockedFetchNightFromCoinpaprika).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopEtfsFromStooq).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopCurrenciesFromFrankfurter).toHaveBeenCalledTimes(1);
  });

  it("serves stale cache when providers fail after cache TTL", async () => {
    const cache = new MemoryCache();
    let now = 2_000_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etfs down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockRejectedValue(new Error("frankfurter down"));

    now += 70_000;

    const payload = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(false);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "topEtfs", "topCurrencies", "night"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("stale-cache");
    expect(payload.topStocks[0]?.symbol).toBe("AAPL");
  });

  it("uses fallback JSON when providers fail and no cache is available", async () => {
    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etfs down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockRejectedValue(new Error("frankfurter down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 3_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "topEtfs", "topCurrencies", "night"]);
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.topCryptos[0]?.id).toBe(dashboardFallbackPayload.topCryptos[0]?.id);
  });

  it("uses monogram fallbacks for commodities instead of blocked SVG logo URLs", () => {
    const commodities = dashboardFallbackPayload.topAssets.filter((asset) => asset.category === "Commodity");

    expect(commodities.length).toBeGreaterThan(0);
    for (const commodity of commodities) {
      expect(commodity.logoUrl).toBeNull();
      expect(commodity.fallbackLogoUrls).toEqual([]);
    }
  });

  it("reports partially degraded segments when a single provider fails", async () => {
    const cache = new MemoryCache();
    const now = 4_000_000;

    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topStocks"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("live");
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
  });

  it("includes topEtfs in the assembled payload", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 5_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topEtfs).toHaveLength(2);
    expect(payload.topEtfs[0]?.symbol).toBe("SPY");
    expect(payload.segmentMeta.topEtfs.source).toBe("live");
  });

  it("marks topEtfs as degraded and uses fallback when ETF provider fails", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etf provider down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 6_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.degradedSegments).toContain("topEtfs");
    expect(payload.segmentMeta.topEtfs.source).toBe("fallback");
    expect(payload.topEtfs.length).toBeGreaterThan(0);
  });

  it("includes topCurrencies in the assembled payload", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 7_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topCurrencies).toHaveLength(2);
    expect(payload.topCurrencies[0]?.symbol).toBe("USD");
    expect(payload.segmentMeta.topCurrencies.source).toBe("live");
  });

  it("does not crash when a provider resolves a malformed segment", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue("not-an-array" as unknown as DashboardStock[]);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 8_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topStocks).toEqual([]);
    expect(payload.topCryptos[0]?.symbol).toBe("BTC");
  });
});

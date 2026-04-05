import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

vi.mock("./providers/fmp", () => ({
  fetchTopStocksFromFmp: vi.fn(),
  fetchTopCurrenciesFromFmp: vi.fn(),
}));

vi.mock("./providers/coinpaprika", () => ({
  fetchTopCryptosFromCoinpaprika: vi.fn(),
  fetchNightFromCoinpaprika: vi.fn(),
}));

import { buildDashboardPayload, dashboardFallbackPayload } from "./dashboard";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopCurrenciesFromFmp, fetchTopStocksFromFmp } from "./providers/fmp";
import type { DashboardCurrency, DashboardCrypto, DashboardNight, DashboardStock } from "./types";

const mockedFetchTopStocksFromFmp = vi.mocked(fetchTopStocksFromFmp);
const mockedFetchTopCryptosFromCoinpaprika = vi.mocked(fetchTopCryptosFromCoinpaprika);
const mockedFetchNightFromCoinpaprika = vi.mocked(fetchNightFromCoinpaprika);
const mockedFetchTopCurrenciesFromFmp = vi.mocked(fetchTopCurrenciesFromFmp);

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
    rateVsUsd: 1.085,
    changePercent: -0.12,
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
    mockedFetchTopStocksFromFmp.mockReset();
    mockedFetchTopCryptosFromCoinpaprika.mockReset();
    mockedFetchNightFromCoinpaprika.mockReset();
    mockedFetchTopCurrenciesFromFmp.mockReset();
  });

  it("returns fresh cache entries within TTL without refetching providers", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopCurrenciesFromFmp.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    now += 30_000;

    await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(mockedFetchTopStocksFromFmp).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopCryptosFromCoinpaprika).toHaveBeenCalledTimes(1);
    expect(mockedFetchNightFromCoinpaprika).toHaveBeenCalledTimes(1);
  });

  it("serves stale cache when providers fail after cache TTL", async () => {
    const cache = new MemoryCache();
    let now = 2_000_000;

    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopCurrenciesFromFmp.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopCurrenciesFromFmp.mockRejectedValue(new Error("currencies down"));

    now += 70_000;

    const payload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(false);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "night", "topCurrencies"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("stale-cache");
    expect(payload.topStocks[0]?.symbol).toBe("AAPL");
  });

  it("uses fallback JSON when providers fail and no cache is available", async () => {
    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopCurrenciesFromFmp.mockRejectedValue(new Error("currencies down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 3_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "night", "topCurrencies"]);
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.topCryptos[0]?.id).toBe(dashboardFallbackPayload.topCryptos[0]?.id);
  });

  it("reports partially degraded segments when a single provider fails", async () => {
    const cache = new MemoryCache();
    const now = 4_000_000;

    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopCurrenciesFromFmp.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topStocks"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("live");
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
  });

  it("includes topCurrencies in the assembled payload", async () => {
    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopCurrenciesFromFmp.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 5_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topCurrencies).toHaveLength(2);
    expect(payload.topCurrencies[0]?.symbol).toBe("USD");
    expect(payload.segmentMeta.topCurrencies.source).toBe("live");
  });

  it("marks topCurrencies as degraded and uses fallback when currency provider fails", async () => {
    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopCurrenciesFromFmp.mockRejectedValue(new Error("forex down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 6_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.degradedSegments).toContain("topCurrencies");
    expect(payload.segmentMeta.topCurrencies.source).toBe("fallback");
    expect(payload.topCurrencies.length).toBeGreaterThan(0);
  });
});

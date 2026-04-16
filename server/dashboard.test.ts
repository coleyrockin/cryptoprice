import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

vi.mock("./providers/fmp", () => ({
  fetchTopStocksFromFmp: vi.fn(),
  fetchTopEtfsFromFmp: vi.fn(),
}));

vi.mock("./providers/coinpaprika", () => ({
  fetchTopCryptosFromCoinpaprika: vi.fn(),
  fetchNightFromCoinpaprika: vi.fn(),
}));

import { buildDashboardPayload, dashboardFallbackPayload } from "./dashboard";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopEtfsFromFmp, fetchTopStocksFromFmp } from "./providers/fmp";
import type { DashboardCrypto, DashboardEtf, DashboardNight, DashboardStock } from "./types";

const mockedFetchTopStocksFromFmp = vi.mocked(fetchTopStocksFromFmp);
const mockedFetchTopCryptosFromCoinpaprika = vi.mocked(fetchTopCryptosFromCoinpaprika);
const mockedFetchNightFromCoinpaprika = vi.mocked(fetchNightFromCoinpaprika);
const mockedFetchTopEtfsFromFmp = vi.mocked(fetchTopEtfsFromFmp);

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
    mockedFetchTopEtfsFromFmp.mockReset();
  });

  it("returns fresh cache entries within TTL without refetching providers", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromFmp.mockResolvedValue(sampleEtfs);

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
    expect(mockedFetchTopEtfsFromFmp).toHaveBeenCalledTimes(1);
  });

  it("serves stale cache when providers fail after cache TTL", async () => {
    const cache = new MemoryCache();
    let now = 2_000_000;

    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromFmp.mockResolvedValue(sampleEtfs);

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
    mockedFetchTopEtfsFromFmp.mockRejectedValue(new Error("etfs down"));

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
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "topEtfs", "night"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("stale-cache");
    expect(payload.topStocks[0]?.symbol).toBe("AAPL");
  });

  it("uses fallback JSON when providers fail and no cache is available", async () => {
    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopEtfsFromFmp.mockRejectedValue(new Error("etfs down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 3_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "topEtfs", "night"]);
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.topCryptos[0]?.id).toBe(dashboardFallbackPayload.topCryptos[0]?.id);
  });

  it("reports partially degraded segments when a single provider fails", async () => {
    const cache = new MemoryCache();
    const now = 4_000_000;

    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromFmp.mockResolvedValue(sampleEtfs);

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

  it("includes topEtfs in the assembled payload", async () => {
    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromFmp.mockResolvedValue(sampleEtfs);

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
    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromFmp.mockRejectedValue(new Error("etf provider down"));

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
});

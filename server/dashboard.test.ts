/* eslint-disable import/order */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

vi.mock("./providers/fmp", () => ({
  fetchTopStocksFromFmp: vi.fn(),
}));

vi.mock("./providers/coinpaprika", () => ({
  fetchTopCryptosFromCoinpaprika: vi.fn(),
  fetchNightFromCoinpaprika: vi.fn(),
}));

import { buildDashboardPayload, dashboardFallbackPayload } from "./dashboard";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopStocksFromFmp } from "./providers/fmp";
import type { DashboardCrypto, DashboardNight, DashboardStock } from "./types";

const mockedFetchTopStocksFromFmp = vi.mocked(fetchTopStocksFromFmp);
const mockedFetchTopCryptosFromCoinpaprika = vi.mocked(fetchTopCryptosFromCoinpaprika);
const mockedFetchNightFromCoinpaprika = vi.mocked(fetchNightFromCoinpaprika);

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
  });

  it("returns fresh cache entries within TTL without refetching providers", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromFmp.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);

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
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "night"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("stale-cache");
    expect(payload.topStocks[0]?.symbol).toBe("AAPL");
  });

  it("uses fallback JSON when providers fail and no cache is available", async () => {
    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 3_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "night"]);
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.topCryptos[0]?.id).toBe(dashboardFallbackPayload.topCryptos[0]?.id);
  });

  it("reports partially degraded segments when a single provider fails", async () => {
    const cache = new MemoryCache();
    const now = 4_000_000;

    mockedFetchTopStocksFromFmp.mockRejectedValue(new Error("fmp down"));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);

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
});

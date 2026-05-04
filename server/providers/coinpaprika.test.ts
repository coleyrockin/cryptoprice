import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTopCryptosFromCoinpaprika, normalizeCoinpaprikaCryptos, normalizeCoinpaprikaNight } from "./coinpaprika";

describe("CoinPaprika provider normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps crypto tickers into normalized dashboard records", () => {
    const cryptos = normalizeCoinpaprikaCryptos([
      {
        id: "btc-bitcoin",
        rank: 1,
        name: "Bitcoin",
        symbol: "BTC",
        quotes: {
          USD: {
            price: 67000,
            market_cap: 1300000000000,
            percent_change_24h: 1.2,
          },
        },
      },
    ]);

    expect(cryptos).toHaveLength(1);
    expect(cryptos[0]).toMatchObject({
      id: "btc-bitcoin",
      symbol: "BTC",
      category: "Crypto",
      priceUsd: 67000,
      marketCapUsd: 1300000000000,
      change24h: 1.2,
    });
    expect(cryptos[0].sparkline7d.length).toBeGreaterThan(1);
    expect(cryptos[0].fallbackLogoUrls.length).toBeGreaterThan(0);
  });

  it("normalizes NIGHT payload and invalid numbers safely", () => {
    const night = normalizeCoinpaprikaNight({
      id: "night-midnight2",
      name: "Midnight",
      symbol: "NIGHT",
      quotes: {
        USD: {
          price: "0.84",
          market_cap: "invalid",
          volume_24h: "5100000",
          ath_price: "1.2",
          percent_change_24h: "-2.35",
          percent_from_price_ath: Infinity,
        },
      },
    });

    expect(night).not.toBeNull();
    expect(night?.priceUsd).toBe(0.84);
    expect(night?.marketCapUsd).toBeNull();
    expect(night?.volume24hUsd).toBe(5100000);
    expect(night?.percentFromAth).toBeNull();
  });

  it("normalizes only the bounded crypto slice requested by the caller", () => {
    const payload = Array.from({ length: 50 }, (_, index) => ({
      id: `coin-${index}`,
      symbol: `C${index}`,
      name: `Coin ${index}`,
      quotes: {
        USD: {
          price: index + 1,
          market_cap: 1000 + index,
        },
      },
    }));

    Object.defineProperty(payload[3], "quotes", {
      get() {
        throw new Error("outside requested slice");
      },
    });

    const cryptos = normalizeCoinpaprikaCryptos(payload, 3);
    expect(cryptos).toHaveLength(3);
    expect(cryptos.map((crypto) => crypto.symbol)).toEqual(["C0", "C1", "C2"]);
  });

  it("rejects non-HTTPS base URL overrides before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTopCryptosFromCoinpaprika({
        baseUrl: "http://api.coinpaprika.com",
        retries: 0,
      }),
    ).rejects.toThrow("Invalid CoinPaprika base URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

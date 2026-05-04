import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTopEtfsFromStooq, fetchTopStocksFromStooq } from "./stooq";

describe("Stooq provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches stock quotes in a single batched Stooq request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "Symbol,Date,Open,High,Low,Close,Volume",
          "NVDA.US,2026-05-04,199.5,201.73,194.74,198.543,85711680",
          "AAPL.US,2026-05-04,279.655,280.63,274.8601,276.873,26725780",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/csv",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stocks = await fetchTopStocksFromStooq({ timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(requestUrl).toContain("s=nvda.us+aapl.us+msft.us");
    expect(stocks).toHaveLength(2);
    expect(stocks[0]).toMatchObject({
      symbol: "NVDA",
      priceUsd: 198.543,
      marketCapUsd: 4_690_000_000_000,
    });
  });

  it("fetches ETF quotes in a single batched Stooq request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "Symbol,Date,Open,High,Low,Close,Volume",
          "SPY.US,2026-05-04,720.07,722.12,715,718.03,38285071",
          "IVV.US,2026-05-04,722.62,725,717.2,720.31,5123456",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/csv",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const etfs = await fetchTopEtfsFromStooq({ timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(requestUrl).toContain("s=spy.us+ivv.us+voo.us");
    expect(etfs).toHaveLength(2);
    expect(etfs[0]).toMatchObject({
      symbol: "SPY",
      priceUsd: 718.03,
      aumUsd: 585_000_000_000,
    });
  });

  it("rejects oversized CSV responses before normalizing quotes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("Symbol,Date,Open,High,Low,Close,Volume\nNVDA.US,2026-04-16,100,101,99,101,123", {
          status: 200,
          headers: {
            "content-type": "text/csv",
            "content-length": "1000000",
          },
        }),
      ),
    );

    await expect(
      fetchTopStocksFromStooq({
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("payload_too_large");
  });

  it("rejects unexpected base URL hosts before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTopStocksFromStooq({
        baseUrl: "https://evil.example",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("Invalid Stooq base URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

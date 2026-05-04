import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTopStocksFromStooq } from "./stooq";

describe("Stooq provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    ).rejects.toThrow("Stooq returned no stock data");
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

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTopCurrenciesFromFrankfurter } from "./frankfurter";

describe("Frankfurter provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the current date when the latest response date is malformed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/latest?")) {
        return Response.json({
          date: "not-a-date",
          rates: {
            EUR: 0.9,
            JPY: 155,
          },
        });
      }

      return Response.json({
        date: "2026-02-23",
        rates: {
          EUR: 0.91,
          JPY: 156,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const currencies = await fetchTopCurrenciesFromFrankfurter({
      baseUrl: "https://frankfurter.example.test",
      retries: 0,
    });

    expect(currencies.length).toBeGreaterThan(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from "vitest";

import {
  SECTION_FILTERS,
  SECTION_LINKS,
  SORT_OPTIONS,
  buildPriceTitle,
  filterAndSortEntries,
  formatRelativeTime,
  formatSegmentAge,
  sourceTone,
} from "./dashboard-filters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardStock,
} from "../types/dashboard";

const btc: DashboardCrypto = {
  id: "btc-bitcoin",
  rank: 3,
  name: "Bitcoin",
  symbol: "BTC",
  category: "Crypto",
  priceUsd: 100_000,
  marketCapUsd: 2_000_000_000_000,
  change24h: 2.5,
  sparkline7d: [],
  logoUrl: null,
  fallbackLogoUrls: [],
};

const apple: DashboardStock = {
  id: "stock-aapl",
  rank: 1,
  name: "Apple",
  symbol: "AAPL",
  category: "Stock",
  marketCapUsd: 3_000_000_000_000,
  priceUsd: 220,
  changePercent: -5,
  logoUrl: null,
  fallbackLogoUrls: [],
};

const euro: DashboardCurrency = {
  id: "currency-eur",
  rank: 2,
  name: "Euro",
  symbol: "EUR",
  category: "Currency",
  rateVsUsd: 1.08,
  changePercent: 0.35,
  logoUrl: null,
  fallbackLogoUrls: [],
};

const gold: DashboardAsset = {
  id: "asset-gold",
  rank: 4,
  name: "Gold",
  symbol: "XAU",
  category: "Commodity",
  marketCapUsd: 20_000_000_000_000,
  logoUrl: null,
  fallbackLogoUrls: [],
};

describe("dashboard-filters", () => {
  it("exposes the same set of section ids/filters used by the toolbar and nav", () => {
    expect(SECTION_FILTERS.map((f) => f.value)).toEqual([
      "all",
      "assets",
      "stocks",
      "private",
      "etfs",
      "currencies",
      "cryptos",
    ]);
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(["rank", "name", "value", "movement"]);
    expect(SECTION_LINKS.map((l) => l.id)).toEqual([
      "section-watchlist",
      "section-portfolio",
      "section-assets",
      "section-stocks",
      "section-private-companies",
      "section-etfs",
      "section-currencies",
      "section-cryptos",
      "section-night",
    ]);
  });

  it("each non-virtual section link maps to a known section filter", () => {
    const known = new Set([...SECTION_FILTERS.map((f) => f.value), "watchlist", "portfolio"]);
    for (const link of SECTION_LINKS) {
      expect(known.has(link.filter)).toBe(true);
    }
  });

  describe("filterAndSortEntries", () => {
    const stocks: DashboardStock[] = [
      apple,
      {
        ...apple,
        id: "stock-msft",
        rank: 3,
        name: "Microsoft",
        symbol: "MSFT",
        priceUsd: 400,
        marketCapUsd: 2_500_000_000_000,
        changePercent: 1,
      },
      {
        ...apple,
        id: "stock-tsla",
        rank: 2,
        name: "Tesla",
        symbol: "TSLA",
        priceUsd: 250,
        marketCapUsd: 1_000_000_000_000,
        changePercent: -10,
      },
    ];

    it("returns rank-ordered list by default", () => {
      const sorted = filterAndSortEntries(stocks, "", "rank");
      expect(sorted.map((s) => s.symbol)).toEqual(["AAPL", "TSLA", "MSFT"]);
    });

    it("sorts by name when requested", () => {
      const sorted = filterAndSortEntries(stocks, "", "name");
      expect(sorted.map((s) => s.symbol)).toEqual(["AAPL", "MSFT", "TSLA"]);
    });

    it("sorts by value (market cap desc for stocks) when requested", () => {
      const sorted = filterAndSortEntries(stocks, "", "value");
      expect(sorted.map((s) => s.symbol)).toEqual(["AAPL", "MSFT", "TSLA"]);
    });

    it("sorts by absolute movement when requested", () => {
      const sorted = filterAndSortEntries(stocks, "", "movement");
      expect(sorted.map((s) => s.symbol)).toEqual(["TSLA", "AAPL", "MSFT"]);
    });

    it("filters by search term across mixed entry types", () => {
      const all = filterAndSortEntries<DashboardCrypto | DashboardStock | DashboardCurrency | DashboardAsset>(
        [btc, apple, euro, gold],
        "currency",
        "rank",
      );
      expect(all.map((e) => e.symbol)).toEqual(["EUR"]);
    });

    it("returns an empty array when nothing matches", () => {
      expect(filterAndSortEntries(stocks, "nothing-matches", "rank")).toEqual([]);
    });
  });

  describe("buildPriceTitle", () => {
    it("falls back to 'live' when no generatedAt is provided", () => {
      expect(buildPriceTitle("$100.00", undefined)).toBe("Exact: $100.00 · Updated live");
    });

    it("uses the provided prefix and timestamp", () => {
      const out = buildPriceTitle("$1.00", "2026-05-01T00:00:00.000Z", "Exact rate");
      expect(out.startsWith("Exact rate: $1.00 · Updated ")).toBe(true);
    });
  });

  describe("formatRelativeTime", () => {
    const now = new Date("2026-05-01T12:00:00.000Z").getTime();

    it("returns em dash for missing or invalid input", () => {
      expect(formatRelativeTime(undefined, now)).toBe("—");
      expect(formatRelativeTime("not-a-date", now)).toBe("—");
    });

    it("returns 'just now' under 5s", () => {
      expect(formatRelativeTime(new Date(now - 1000).toISOString(), now)).toBe("just now");
    });

    it("formats seconds, minutes, and hours", () => {
      expect(formatRelativeTime(new Date(now - 30_000).toISOString(), now)).toBe("30s ago");
      expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
      expect(formatRelativeTime(new Date(now - 2 * 60 * 60_000).toISOString(), now)).toBe("2h ago");
    });
  });

  describe("segment health helpers", () => {
    it("formats segment ages with second / minute / hour granularity", () => {
      expect(formatSegmentAge(15)).toBe("15s");
      expect(formatSegmentAge(120)).toBe("2m");
      expect(formatSegmentAge(7_200)).toBe("2h");
    });

    it("classifies sources into traffic-light tones", () => {
      expect(sourceTone("live")).toBe("positive");
      expect(sourceTone("fresh-cache")).toBe("positive");
      expect(sourceTone("stale-cache")).toBe("warning");
      expect(sourceTone("durable-cache")).toBe("warning");
      expect(sourceTone("fallback")).toBe("negative");
    });
  });
});

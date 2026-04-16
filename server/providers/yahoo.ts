import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber, toSafeString } from "../sanitize.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com";

// Fixed lists — top 10 by market cap / AUM. Composition rarely changes.
const TOP_STOCK_SYMBOLS = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "TSM", "META", "AVGO", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS   = ["SPY",  "IVV",  "VOO",  "VTI",  "QQQ",  "VUG", "BND",  "AGG",  "VXUS",  "GLD"];

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

type YahooQuoteResult = {
  symbol?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number | string;
  marketCap?: number | string;
  totalAssets?: number | string;
  regularMarketChangePercent?: number | string;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResult[];
    error?: unknown;
  };
};

export type FetchYahooOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
};

async function fetchYahooQuotes(
  symbols: string[],
  options: FetchYahooOptions,
): Promise<YahooQuoteResult[]> {
  const baseUrl = options.baseUrl ?? YAHOO_BASE_URL;
  const url = `${baseUrl}/v7/finance/quote?symbols=${symbols.join(",")}`;

  const data = await requestJsonWithRetry<YahooQuoteResponse>(url, {
    timeoutMs: options.timeoutMs ?? 6_000,
    retries: options.retries,
    headers: YAHOO_HEADERS,
  });

  return data?.quoteResponse?.result ?? [];
}

export async function fetchTopStocksFromYahoo(
  options: FetchYahooOptions = {},
): Promise<DashboardStock[]> {
  const results = await fetchYahooQuotes(TOP_STOCK_SYMBOLS, options);

  const mapped: DashboardStock[] = [];
  for (const item of results) {
    const symbol = toSafeString(item.symbol, "").toUpperCase();
    if (!symbol) continue;

    mapped.push({
      id: `stock-${symbol.toLowerCase().replace(".", "-")}`,
      rank: 1, // reassigned after sort
      name: toSafeString(item.longName ?? item.shortName, symbol),
      symbol,
      category: "Stock" as const,
      marketCapUsd: toFiniteNumber(item.marketCap),
      priceUsd: toFiniteNumber(item.regularMarketPrice),
      changePercent: toFiniteNumber(item.regularMarketChangePercent),
      logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
      fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
    });
  }

  const stocks = mapped
    .sort((a, b) => (b.marketCapUsd ?? Number.NEGATIVE_INFINITY) - (a.marketCapUsd ?? Number.NEGATIVE_INFINITY))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  if (stocks.length === 0) {
    throw new Error("Yahoo Finance returned no stock data");
  }

  return stocks;
}

export async function fetchTopEtfsFromYahoo(
  options: FetchYahooOptions = {},
): Promise<DashboardEtf[]> {
  const results = await fetchYahooQuotes(TOP_ETF_SYMBOLS, options);

  const mapped: DashboardEtf[] = [];
  for (const item of results) {
    const symbol = toSafeString(item.symbol, "").toUpperCase();
    if (!symbol) continue;

    // Yahoo returns totalAssets for ETF AUM; fall back to marketCap
    const aumUsd = toFiniteNumber(item.totalAssets) ?? toFiniteNumber(item.marketCap);

    mapped.push({
      id: `etf-${symbol.toLowerCase()}`,
      rank: 1,
      name: toSafeString(item.longName ?? item.shortName, symbol),
      symbol,
      category: "ETF" as const,
      aumUsd,
      priceUsd: toFiniteNumber(item.regularMarketPrice),
      changePercent: toFiniteNumber(item.regularMarketChangePercent),
      logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
      fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
    });
  }

  const etfs = mapped
    .sort((a, b) => (b.aumUsd ?? Number.NEGATIVE_INFINITY) - (a.aumUsd ?? Number.NEGATIVE_INFINITY))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  if (etfs.length === 0) {
    throw new Error("Yahoo Finance returned no ETF data");
  }

  return etfs;
}

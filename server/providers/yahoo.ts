import { runtimeCache } from "../cache.js";
import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber, toSafeString } from "../sanitize.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com";
const YAHOO_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YAHOO_COOKIE_URL = "https://fc.yahoo.com/";
const CRUMB_CACHE_KEY = "yahoo:crumb";
const CRUMB_TTL_SEC = 3_600; // 1 hour — crumbs are long-lived

// Fixed lists — top 10 by market cap / AUM. Composition rarely changes.
const TOP_STOCK_SYMBOLS = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "TSM", "META", "AVGO", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS   = ["SPY",  "IVV",  "VOO",  "VTI",  "QQQ",  "VUG", "BND",  "AGG",  "VXUS",  "GLD"];

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
};

type YahooCrumb = { crumb: string; cookie: string };

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

/**
 * Yahoo Finance requires a crumb + session cookie when called from server/data-center IPs.
 * Flow: fc.yahoo.com → session cookie → getcrumb endpoint → crumb string.
 * The crumb+cookie are cached in Lambda memory for 1 hour.
 */
async function fetchYahooCrumb(timeoutMs: number): Promise<YahooCrumb> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 1 — get session cookie from Yahoo's consent/fingerprint endpoint
    const cookieRes = await fetch(YAHOO_COOKIE_URL, {
      headers: {
        "User-Agent": YAHOO_HEADERS["User-Agent"],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    // Node 18+ supports getSetCookie(); fall back to get() for older runtimes
    const headersAny = cookieRes.headers as unknown as { getSetCookie?: () => string[] };
    const rawCookies: string[] =
      typeof headersAny.getSetCookie === "function"
        ? headersAny.getSetCookie()
        : [cookieRes.headers.get("set-cookie") ?? ""].filter(Boolean);

    const cookie = rawCookies
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    // Step 2 — exchange cookie for a crumb
    const crumbRes = await fetch(YAHOO_CRUMB_URL, {
      headers: {
        ...YAHOO_HEADERS,
        Cookie: cookie,
      },
      signal: controller.signal,
    });

    if (!crumbRes.ok) {
      throw new Error(`Yahoo crumb fetch failed: HTTP ${crumbRes.status}`);
    }

    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length < 2) {
      throw new Error("Yahoo returned empty crumb");
    }

    return { crumb, cookie };
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedCrumb(timeoutMs: number): Promise<YahooCrumb> {
  const cached = runtimeCache.getFresh<YahooCrumb>(CRUMB_CACHE_KEY, CRUMB_TTL_SEC);
  if (cached) return cached;

  const fresh = await fetchYahooCrumb(timeoutMs);
  runtimeCache.set(CRUMB_CACHE_KEY, fresh);
  return fresh;
}

async function fetchYahooQuotes(
  symbols: string[],
  options: FetchYahooOptions,
): Promise<YahooQuoteResult[]> {
  const baseUrl = options.baseUrl ?? YAHOO_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 8_000;

  const { crumb, cookie } = await getCachedCrumb(timeoutMs);
  const url = `${baseUrl}/v7/finance/quote?symbols=${symbols.join(",")}&crumb=${encodeURIComponent(crumb)}`;

  const data = await requestJsonWithRetry<YahooQuoteResponse>(url, {
    timeoutMs,
    retries: options.retries,
    headers: {
      ...YAHOO_HEADERS,
      Cookie: cookie,
    },
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

import { toFiniteNumber, toSafeString } from "../sanitize.js";
import { readResponseTextWithLimit, requestJsonWithRetry } from "../request.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { DashboardEtf, DashboardStock, HistoricalPoint, HistoricalRange } from "../types.js";

import fallbackPayloadJson from "../fallback/dashboard-fallback.json" with { type: "json" };

const STOOQ_BASE_URL = "https://stooq.com";
const YAHOO_FINANCE_BASE_URL = "https://query1.finance.yahoo.com";
const STOOQ_MAX_RESPONSE_BYTES = 64_000;
const STOOQ_HISTORY_MAX_RESPONSE_BYTES = 256_000;
export const EQUITY_FUNDAMENTALS_AS_OF = "2026-05-14";
export const EQUITY_QUOTE_PROVIDERS = "stooq+yahoo-finance";

// Lists ordered by current market cap / AUM. Ranking is positional —
// Stooq does not expose those values, so we derive them from the static
// share/unit counts below multiplied by the live close price.
const TOP_STOCK_SYMBOLS = ["NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "TSM", "AVGO", "META", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS = ["VOO", "IVV", "SPY", "VTI", "QQQ", "VUG", "GLD", "BND", "VXUS", "AGG"];

type FallbackStockRow = {
  symbol?: string;
  marketCapUsd?: number | null;
  priceUsd?: number | null;
};

type FallbackEtfRow = {
  symbol?: string;
  aumUsd?: number | null;
  priceUsd?: number | null;
};

const HISTORY_RANGE_DAYS: Record<HistoricalRange, number> = {
  "7D": 14,
  "30D": 45,
  "1Y": 370,
};

function normalizeFallbackSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace("BRK.B", "BRK-B");
}

function fallbackUnitsFromRows(rows: unknown[], valueKey: "marketCapUsd" | "aumUsd"): Record<string, number> {
  const units: Record<string, number> = {};

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const candidate = row as Partial<FallbackStockRow & FallbackEtfRow>;
    const symbolRaw = typeof candidate.symbol === "string" ? candidate.symbol : "";
    const symbol = normalizeFallbackSymbol(symbolRaw);
    if (!symbol) continue;

    const value = toFiniteNumber(candidate[valueKey]);
    const price = toFiniteNumber(candidate.priceUsd);
    if (value === null || price === null || !Number.isFinite(value) || !Number.isFinite(price) || price <= 0 || value <= 0) {
      continue;
    }

    const computedUnits = value / price;
    if (!Number.isFinite(computedUnits) || computedUnits <= 0) continue;
    units[symbol] = Math.round(computedUnits);
  }

  return units;
}

const FALLBACK_STOCK_UNITS = fallbackUnitsFromRows((fallbackPayloadJson as { topStocks?: unknown[] }).topStocks ?? [], "marketCapUsd");
const FALLBACK_ETF_UNITS = fallbackUnitsFromRows((fallbackPayloadJson as { topEtfs?: unknown[] }).topEtfs ?? [], "aumUsd");

// Share estimates are May 2026 public share counts used to derive live mcap from close prices.
const STOCK_SHARES_ESTIMATE: Record<string, number> = {
  NVDA: 24_300_000_000,
  AAPL: 14_690_000_000,
  MSFT: 7_430_000_000,
  GOOGL: 12_440_000_000,
  AMZN: 11_120_000_000,
  TSM: 5_490_000_000,
  META: 2_530_000_000,
  AVGO: 4_730_000_000,
  "BRK-B": 2_160_000_000,
  LLY: 891_740_000,
};

const ETF_UNITS_ESTIMATE: Record<string, number> = {
  VOO: 1_392_000_000,
  IVV: 1_096_000_000,
  SPY: 1_016_000_000,
  VTI: 1_747_000_000,
  QQQ: 644_000_000,
  VUG: 3_632_800_000,
  GLD: 366_108_000,
  BND: 2_085_000_000,
  VXUS: 1_744_000_000,
  AGG: 1_405_700_000,
};

function resolveStockShares(symbol: string): number {
  return STOCK_SHARES_ESTIMATE[symbol] ?? FALLBACK_STOCK_UNITS[symbol] ?? 0;
}

function resolveEtfUnits(symbol: string): number {
  return ETF_UNITS_ESTIMATE[symbol] ?? FALLBACK_ETF_UNITS[symbol] ?? 0;
}

// Human-readable names (Stooq doesn't return full names)
const STOCK_NAMES: Record<string, string> = {
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  TSM: "TSMC",
  META: "Meta Platforms",
  AVGO: "Broadcom",
  "BRK-B": "Berkshire Hathaway",
  LLY: "Eli Lilly",
};

const ETF_NAMES: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF",
  IVV: "iShares Core S&P 500 ETF",
  VOO: "Vanguard S&P 500 ETF",
  VTI: "Vanguard Total Stock Market ETF",
  QQQ: "Invesco QQQ Trust",
  VUG: "Vanguard Growth ETF",
  BND: "Vanguard Total Bond Market ETF",
  AGG: "iShares Core U.S. Aggregate Bond ETF",
  VXUS: "Vanguard Total International Stock ETF",
  GLD: "SPDR Gold Shares",
};

export type FetchStooqOptions = {
  baseUrl?: string;
  yahooBaseUrl?: string;
  timeoutMs?: number;
};

type EquityQuote = {
  open: number | null;
  close: number | null;
};

type YahooFinanceQuote = {
  symbol?: string;
  regularMarketOpen?: number | string;
  regularMarketPrice?: number | string;
  regularMarketPreviousClose?: number | string;
};

type YahooFinanceQuoteResponse = {
  quoteResponse?: {
    result?: YahooFinanceQuote[];
  };
};

// Stooq uses lowercase .us suffix: NVDA → nvda.us, BRK-B → brk-b.us
function toStooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
}

function fromStooqSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/, "");
}

function parseStooqRows(text: string): Map<string, EquityQuote> {
  const map = new Map<string, EquityQuote>();
  const lines = text.trim().split(/\r?\n/).slice(1);

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 6) continue;

    const symbol = fromStooqSymbol(parts[0] ?? "");
    const open = toFiniteNumber(parts[2]);
    const close = toFiniteNumber(parts[5]);
    if (!symbol || close === null) continue;

    map.set(symbol, { open, close });
  }

  return map;
}

async function fetchStooqQuotes(
  symbols: string[],
  options: FetchStooqOptions,
): Promise<Map<string, EquityQuote>> {
  const baseUrl = resolveProviderBaseUrl(options.baseUrl ?? process.env.STOOQ_BASE_URL, STOOQ_BASE_URL, "Stooq", "stooq.com");
  const stooqSymbols = symbols.map(toStooqSymbol).join("+");
  // f=sd2ohlcv: Symbol, Date, Open, High, Low, Close, Volume
  const url = `${baseUrl}/q/l/?s=${stooqSymbols}&f=sd2ohlcv&h&e=csv`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/csv,text/plain,*/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await readResponseTextWithLimit(response, STOOQ_MAX_RESPONSE_BYTES);
    // CSV: header line + one data line per requested symbol
    // Symbol,Date,Open,High,Low,Close,Volume
    // NVDA.US,2026-04-16,197.43,197.79,196.6,196.675,1954302
    return parseStooqRows(text);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeYahooSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace("BRK.B", "BRK-B");
}

function parseYahooQuotes(payload: unknown): Map<string, EquityQuote> {
  const map = new Map<string, EquityQuote>();
  const quotes = (payload as YahooFinanceQuoteResponse).quoteResponse?.result;
  if (!Array.isArray(quotes)) return map;

  for (const quote of quotes) {
    const symbol = normalizeYahooSymbol(toSafeString(quote.symbol, ""));
    const close = toFiniteNumber(quote.regularMarketPrice);
    if (!symbol || close === null) continue;

    map.set(symbol, {
      close,
      open: toFiniteNumber(quote.regularMarketOpen) ?? toFiniteNumber(quote.regularMarketPreviousClose),
    });
  }

  return map;
}

async function fetchYahooFinanceQuotes(symbols: string[], options: FetchStooqOptions): Promise<Map<string, EquityQuote>> {
  const baseUrl = resolveProviderBaseUrl(
    options.yahooBaseUrl ?? process.env.YAHOO_FINANCE_BASE_URL,
    YAHOO_FINANCE_BASE_URL,
    "Yahoo Finance",
    "query1.finance.yahoo.com",
  );
  const url = new URL(`${baseUrl}/v7/finance/quote`);
  url.searchParams.set("symbols", symbols.join(","));

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: 0,
    maxBytes: STOOQ_MAX_RESPONSE_BYTES,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json,*/*",
    },
  });

  return parseYahooQuotes(payload);
}

async function fetchEquityQuotes(symbols: string[], options: FetchStooqOptions): Promise<Map<string, EquityQuote>> {
  const quotes = new Map<string, EquityQuote>();
  let stooqError: unknown;

  try {
    const stooqQuotes = await fetchStooqQuotes(symbols, options);
    stooqQuotes.forEach((quote, symbol) => {
      quotes.set(symbol, quote);
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "payload_too_large" || error.message === "Invalid Stooq base URL")) {
      throw error;
    }
    stooqError = error;
  }

  const missingSymbols = symbols.filter((symbol) => !quotes.has(symbol));
  if (missingSymbols.length > 0) {
    try {
      const yahooQuotes = await fetchYahooFinanceQuotes(missingSymbols, options);
      yahooQuotes.forEach((quote, symbol) => {
        quotes.set(symbol, quote);
      });
    } catch (error) {
      if (error instanceof Error && (error.message === "payload_too_large" || error.message === "Invalid Yahoo Finance base URL")) {
        throw error;
      }
      if (quotes.size === 0) {
        const stooqMessage = stooqError instanceof Error ? stooqError.message : "no Stooq data";
        const yahooMessage = error instanceof Error ? error.message : "unknown Yahoo Finance error";
        throw new Error(`Equity quote providers returned no data (Stooq: ${stooqMessage}; Yahoo Finance: ${yahooMessage})`);
      }
    }
  }

  return quotes;
}

function ymd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseStooqHistoryRows(text: string): HistoricalPoint[] {
  const lines = text.trim().split(/\r?\n/).slice(1);

  return lines
    .map((line) => {
      const parts = line.split(",");
      const date = parts[0] ?? "";
      const close = toFiniteNumber(parts[4]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        t: `${date}T00:00:00.000Z`,
        value: close,
      };
    })
    .filter((point): point is HistoricalPoint => point !== null);
}

export async function fetchHistoricalPricesFromStooq(
  symbol: string,
  range: HistoricalRange,
  options: FetchStooqOptions = {},
): Promise<HistoricalPoint[]> {
  const baseUrl = resolveProviderBaseUrl(options.baseUrl ?? process.env.STOOQ_BASE_URL, STOOQ_BASE_URL, "Stooq", "stooq.com");
  const safeSymbol = symbol.trim().toLowerCase().replace(".", "-");
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - HISTORY_RANGE_DAYS[range]);

  const url = `${baseUrl}/q/d/l/?s=${safeSymbol}.us&d1=${ymd(start)}&d2=${ymd(end)}&i=d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/csv,text/plain,*/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await readResponseTextWithLimit(response, STOOQ_HISTORY_MAX_RESPONSE_BYTES);
    const points = parseStooqHistoryRows(text);
    if (points.length === 0) {
      throw new Error("Stooq returned no historical prices");
    }

    return points;
  } finally {
    clearTimeout(timer);
  }
}

function calcChangePercent(open: number | null, close: number | null): number | null {
  if (open === null || close === null || open === 0) return null;
  return ((close - open) / open) * 100;
}

function calcEstimatedValue(priceUsd: number | null, unitCount: number): number | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || !Number.isFinite(unitCount) || unitCount <= 0) {
    return null;
  }

  return Math.round(priceUsd * unitCount);
}

function rankByEstimatedValue<T extends { rank: number }>(rows: T[], valueFor: (row: T) => number | null): T[] {
  return [...rows]
    .sort((left, right) => {
      const leftValue = valueFor(left) ?? Number.NEGATIVE_INFINITY;
      const rightValue = valueFor(right) ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export async function fetchTopStocksFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardStock[]> {
  const quotes = await fetchEquityQuotes(TOP_STOCK_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Equity quote providers returned no stock data");
  }

  const stocks = TOP_STOCK_SYMBOLS
    .map((symbol): DashboardStock | null => {
      const q = quotes.get(symbol);
      if (!q) return null;

      return {
        id: `stock-${symbol.toLowerCase().replace(".", "-")}`,
        rank: 0,
        name: toSafeString(STOCK_NAMES[symbol], symbol),
        symbol,
        category: "Stock" as const,
        marketCapUsd: calcEstimatedValue(q.close, resolveStockShares(symbol)),
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((s): s is DashboardStock => s !== null);

  return rankByEstimatedValue(stocks, (stock) => stock.marketCapUsd);
}

export async function fetchTopEtfsFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardEtf[]> {
  const quotes = await fetchEquityQuotes(TOP_ETF_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Equity quote providers returned no ETF data");
  }

  const etfs = TOP_ETF_SYMBOLS
    .map((symbol): DashboardEtf | null => {
      const q = quotes.get(symbol);
      if (!q) return null;

      return {
        id: `etf-${symbol.toLowerCase()}`,
        rank: 0,
        name: toSafeString(ETF_NAMES[symbol], symbol),
        symbol,
        category: "ETF" as const,
        aumUsd: calcEstimatedValue(q.close, resolveEtfUnits(symbol)),
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);

  return rankByEstimatedValue(etfs, (etf) => etf.aumUsd);
}

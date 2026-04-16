import { toFiniteNumber, toSafeString } from "../sanitize.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

const STOOQ_BASE_URL = "https://stooq.com";

// Fixed lists ordered by approximate market cap / AUM.
// Rank is positional — Stooq does not provide market cap or AUM.
const TOP_STOCK_SYMBOLS = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "TSM", "META", "AVGO", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS   = ["SPY",  "IVV",  "VOO",  "VTI",  "QQQ",  "VUG", "BND",  "AGG",  "VXUS",  "GLD"];

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
  timeoutMs?: number;
};

// Stooq uses lowercase .us suffix: NVDA → nvda.us, BRK-B → brk-b.us
function toStooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
}

async function fetchStooqQuote(
  symbol: string,
  options: FetchStooqOptions,
): Promise<{ open: number | null; close: number | null } | null> {
  const baseUrl = options.baseUrl ?? STOOQ_BASE_URL;
  const stooqSym = toStooqSymbol(symbol);
  // f=sd2ohlcv: Symbol, Date, Open, High, Low, Close, Volume
  const url = `${baseUrl}/q/l/?s=${stooqSym}&f=sd2ohlcv&h&e=csv`;

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

    const text = await response.text();
    // CSV: header line + data line
    // Symbol,Date,Open,High,Low,Close,Volume
    // NVDA.US,2026-04-16,197.43,197.79,196.6,196.675,1954302
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;

    const parts = lines[1].split(",");
    // parts: [Symbol, Date, Open, High, Low, Close, Volume]
    const open = toFiniteNumber(parts[2]);
    const close = toFiniteNumber(parts[5]);

    if (close === null) return null;
    return { open, close };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch all symbols in parallel, returning a map of symbol → quote data.
 * Failures are silently dropped so partial results still render.
 */
async function fetchAllQuotes(
  symbols: string[],
  options: FetchStooqOptions,
): Promise<Map<string, { open: number | null; close: number | null }>> {
  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const quote = await fetchStooqQuote(sym, options);
      return { sym, quote };
    }),
  );

  const map = new Map<string, { open: number | null; close: number | null }>();
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.quote) {
      map.set(r.value.sym, r.value.quote);
    }
  }
  return map;
}

function calcChangePercent(open: number | null, close: number | null): number | null {
  if (open === null || close === null || open === 0) return null;
  return ((close - open) / open) * 100;
}

export async function fetchTopStocksFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardStock[]> {
  const quotes = await fetchAllQuotes(TOP_STOCK_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Stooq returned no stock data");
  }

  return TOP_STOCK_SYMBOLS
    .map((symbol, index): DashboardStock | null => {
      const q = quotes.get(symbol);
      if (!q) return null;

      return {
        id: `stock-${symbol.toLowerCase().replace(".", "-")}`,
        rank: index + 1,
        name: toSafeString(STOCK_NAMES[symbol], symbol),
        symbol,
        category: "Stock" as const,
        marketCapUsd: null,
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((s): s is DashboardStock => s !== null);
}

export async function fetchTopEtfsFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardEtf[]> {
  const quotes = await fetchAllQuotes(TOP_ETF_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Stooq returned no ETF data");
  }

  return TOP_ETF_SYMBOLS
    .map((symbol, index): DashboardEtf | null => {
      const q = quotes.get(symbol);
      if (!q) return null;

      return {
        id: `etf-${symbol.toLowerCase()}`,
        rank: index + 1,
        name: toSafeString(ETF_NAMES[symbol], symbol),
        symbol,
        category: "ETF" as const,
        aumUsd: null,
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);
}

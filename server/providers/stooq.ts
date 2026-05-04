import { toFiniteNumber, toSafeString } from "../sanitize.js";
import { readResponseTextWithLimit } from "../request.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

const STOOQ_BASE_URL = "https://stooq.com";
const STOOQ_MAX_RESPONSE_BYTES = 64_000;

// Fixed lists ordered by approximate market cap / AUM.
// Rank is positional — Stooq does not provide market cap or AUM.
const TOP_STOCK_SYMBOLS = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "TSM", "META", "AVGO", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS   = ["SPY",  "IVV",  "VOO",  "VTI",  "QQQ",  "VUG", "BND",  "AGG",  "VXUS",  "GLD"];

const STOCK_MARKET_CAP_USD: Record<string, number> = {
  NVDA: 4_690_000_000_000,
  AAPL: 4_000_000_000_000,
  MSFT: 2_890_000_000_000,
  GOOGL: 3_760_000_000_000,
  AMZN: 2_240_000_000_000,
  TSM: 1_630_000_000_000,
  META: 1_620_000_000_000,
  AVGO: 1_540_000_000_000,
  "BRK-B": 1_070_000_000_000,
  LLY: 983_000_000_000,
};

const ETF_AUM_USD: Record<string, number> = {
  SPY: 585_000_000_000,
  IVV: 510_000_000_000,
  VOO: 485_000_000_000,
  VTI: 395_000_000_000,
  QQQ: 292_000_000_000,
  VUG: 125_000_000_000,
  BND: 118_000_000_000,
  AGG: 106_000_000_000,
  VXUS: 72_000_000_000,
  GLD: 67_000_000_000,
};

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

function fromStooqSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/, "");
}

function parseStooqRows(text: string): Map<string, { open: number | null; close: number | null }> {
  const map = new Map<string, { open: number | null; close: number | null }>();
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
): Promise<Map<string, { open: number | null; close: number | null }>> {
  const baseUrl = resolveProviderBaseUrl(options.baseUrl, STOOQ_BASE_URL, "Stooq", "stooq.com");
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

function calcChangePercent(open: number | null, close: number | null): number | null {
  if (open === null || close === null || open === 0) return null;
  return ((close - open) / open) * 100;
}

export async function fetchTopStocksFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardStock[]> {
  const quotes = await fetchStooqQuotes(TOP_STOCK_SYMBOLS, options);

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
        marketCapUsd: STOCK_MARKET_CAP_USD[symbol] ?? null,
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
  const quotes = await fetchStooqQuotes(TOP_ETF_SYMBOLS, options);

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
        aumUsd: ETF_AUM_USD[symbol] ?? null,
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);
}

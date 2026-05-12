import { toFiniteNumber, toSafeString } from "../sanitize.js";
import { readResponseTextWithLimit } from "../request.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

const STOOQ_BASE_URL = "https://stooq.com";
const STOOQ_MAX_RESPONSE_BYTES = 64_000;
export const EQUITY_FUNDAMENTALS_AS_OF = "2026-05-04";

// Date the share/unit counts below were last reconciled against the most
// recent company filings and ETF fact sheets. Bump this whenever the maps
// are refreshed so the UI can disclose the as-of date for fundamentals.
export const EQUITY_FUNDAMENTALS_AS_OF = "2026-05-12";

// Lists ordered by current market cap / AUM. Ranking is positional —
// Stooq does not expose those values, so we derive them from the static
// share/unit counts below multiplied by the live close price.
const TOP_STOCK_SYMBOLS = ["NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "TSM", "AVGO", "META", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS   = ["VOO",  "SPY",   "IVV",  "VTI",  "QQQ",  "VUG", "BND",  "AGG",  "GLD",   "VXUS"];

// Shares outstanding (basic). Sources: most recent 10-Q/10-K filings.
// For TSM the figure is converted to ADR-equivalents (1 ADR = 5 ordinary).
// For Alphabet the figure represents the combined Class A + B + C float.
// For Berkshire the figure is converted to Class-B-equivalents (1 A = 1500 B).
const STOCK_SHARES_OUTSTANDING: Record<string, number> = {
  NVDA: 24_410_000_000,
  GOOGL: 12_177_960_000,
  AAPL: 15_115_823_000,
  MSFT: 7_433_490_000,
  AMZN: 10_632_550_000,
  TSM: 5_186_550_000,
  AVGO: 4_731_140_000,
  META: 2_551_300_000,
  "BRK-B": 2_158_300_000,
  LLY: 898_290_000,
};

// ETF units outstanding (creation units × shares per CU). Sources: issuer
// fact sheets. AUM = units × NAV ≈ units × close price.
const ETF_UNITS_OUTSTANDING: Record<string, number> = {
  VOO: 1_600_000_000,
  SPY: 800_000_000,
  IVV: 700_000_000,
  VTI: 1_400_000_000,
  QQQ: 450_000_000,
  VUG: 1_965_000_000,
  BND: 1_750_000_000,
  AGG: 1_210_000_000,
  GLD: 215_000_000,
  VXUS: 1_100_000_000,
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

function calcEstimatedValue(priceUsd: number | null, unitCount: number): number | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || !Number.isFinite(unitCount) || unitCount <= 0) {
    return null;
  }

  return Math.round(priceUsd * unitCount);
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
        marketCapUsd: calcEstimatedValue(q.close, STOCK_SHARES_OUTSTANDING[symbol] ?? 0),
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
        aumUsd: calcEstimatedValue(q.close, ETF_UNITS_OUTSTANDING[symbol] ?? 0),
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);
}

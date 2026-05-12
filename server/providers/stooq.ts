import { toFiniteNumber, toSafeString } from "../sanitize.js";
import { readResponseTextWithLimit } from "../request.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { DashboardEtf, DashboardStock } from "../types.js";

import fallbackPayloadJson from "../fallback/dashboard-fallback.json" with { type: "json" };

const STOOQ_BASE_URL = "https://stooq.com";
const STOOQ_MAX_RESPONSE_BYTES = 64_000;
export const EQUITY_FUNDAMENTALS_AS_OF = "2026-05-12";

// Lists ordered by current market cap / AUM. Ranking is positional —
// Stooq does not expose those values, so we derive them from the static
// share/unit counts below multiplied by the live close price.
const TOP_STOCK_SYMBOLS = ["NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "TSM", "AVGO", "META", "BRK-B", "LLY"];
const TOP_ETF_SYMBOLS = ["VOO", "SPY", "IVV", "VTI", "QQQ", "VUG", "BND", "AGG", "GLD", "VXUS"];

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

// Share and unit estimates are snapshot values used to derive live mcap/AUM from close prices.
const STOCK_SHARES_ESTIMATE: Record<string, number> = {
  NVDA: 27_638_060_669,
  AAPL: 14_698_317_043,
  MSFT: 6_635_288_715,
  GOOGL: 21_154_495_330,
  AMZN: 9_779_097_180,
  TSM: 8_917_336_835,
  META: 2_817_930_387,
  AVGO: 7_603_811_781,
  "BRK-B": 1_816_083_370,
  LLY: 1_336_051_648,
};

const ETF_UNITS_ESTIMATE: Record<string, number> = {
  SPY: 1_107_011_070,
  IVV: 962_046_329,
  VOO: 994_606_566,
  VTI: 1_613_693_929,
  QQQ: 641_307_213,
  VUG: 376_313_334,
  BND: 1_607_191_501,
  AGG: 1_099_813_239,
  VXUS: 1_183_431_953,
  GLD: 280_875_325,
};

function resolveStockShares(symbol: string): number {
  return FALLBACK_STOCK_UNITS[symbol] ?? STOCK_SHARES_ESTIMATE[symbol] ?? 0;
}

function resolveEtfUnits(symbol: string): number {
  return FALLBACK_ETF_UNITS[symbol] ?? ETF_UNITS_ESTIMATE[symbol] ?? 0;
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
        marketCapUsd: calcEstimatedValue(q.close, resolveStockShares(symbol)),
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
        aumUsd: calcEstimatedValue(q.close, resolveEtfUnits(symbol)),
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);
}

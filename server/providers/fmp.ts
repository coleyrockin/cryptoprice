import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber, toLogoCandidates, toSafeString } from "../sanitize.js";
import type { DashboardCurrency, DashboardStock } from "../types.js";

const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

type FmpStockScreenerItem = {
  symbol?: string;
  companyName?: string;
  marketCap?: number | string;
  price?: number | string;
  changesPercentage?: number | string;
  image?: string;
};

export type FetchFmpStocksOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  limit?: number;
};

function parseChangePercent(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const cleaned = trimmed.replace(/[()%]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeSymbol(value: unknown): string {
  return toSafeString(value, "UNK").toUpperCase();
}

export function normalizeFmpStock(item: FmpStockScreenerItem, rank: number): DashboardStock | null {
  const symbol = normalizeSymbol(item.symbol);
  if (!symbol) {
    return null;
  }

  const logoCandidates = toLogoCandidates(
    item.image,
    `https://financialmodelingprep.com/image-stock/${symbol}.png`,
    `https://images.financialmodelingprep.com/symbol/${symbol}.png`,
  );

  const [logoUrl, ...fallbackLogoUrls] = logoCandidates;

  return {
    id: `stock-${symbol.toLowerCase()}`,
    rank,
    name: toSafeString(item.companyName, symbol),
    symbol,
    category: "Stock",
    marketCapUsd: toFiniteNumber(item.marketCap),
    priceUsd: toFiniteNumber(item.price),
    changePercent: parseChangePercent(item.changesPercentage),
    logoUrl: logoUrl ?? null,
    fallbackLogoUrls,
  };
}

export function normalizeFmpStocks(payload: unknown, limit = 10): DashboardStock[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => normalizeFmpStock((entry ?? {}) as FmpStockScreenerItem, index + 1))
    .filter((entry): entry is DashboardStock => Boolean(entry))
    .sort((left, right) => {
      const leftCap = left.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      const rightCap = right.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      return rightCap - leftCap;
    })
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export async function fetchTopStocksFromFmp(options: FetchFmpStocksOptions = {}): Promise<DashboardStock[]> {
  const limit = Math.max(1, Math.min(25, options.limit ?? 10));
  const apiKey = options.apiKey ?? process.env.FMP_API_KEY ?? "demo";
  const baseUrl = options.baseUrl ?? process.env.FMP_BASE_URL ?? FMP_BASE_URL;

  const url = new URL(`${baseUrl}/stock-screener`);
  url.searchParams.set("marketCapMoreThan", "1000000000");
  url.searchParams.set("isEtf", "false");
  url.searchParams.set("isFund", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apikey", apiKey);

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });

  const normalized = normalizeFmpStocks(payload, limit);

  if (normalized.length === 0) {
    const shape = Array.isArray(payload) ? `array(${payload.length})` : typeof payload;
    throw new Error(`FMP returned no stocks (response was ${shape})`);
  }

  return normalized;
}

// ── Forex / Currencies ──────────────────────────────────────────────────────

type FmpForexQuote = {
  symbol?: string;
  price?: number | string;
  changesPercentage?: number | string;
};

type CurrencyDef = {
  symbol: string;
  name: string;
  pairSymbol: string | null;
  countryCode: string;
  inverse: boolean;
};

const CURRENCY_DEFINITIONS: CurrencyDef[] = [
  { symbol: "USD", name: "US Dollar",          pairSymbol: null,       countryCode: "us", inverse: false },
  { symbol: "EUR", name: "Euro",               pairSymbol: "EURUSD",   countryCode: "eu", inverse: false },
  { symbol: "JPY", name: "Japanese Yen",       pairSymbol: "USDJPY",   countryCode: "jp", inverse: true  },
  { symbol: "GBP", name: "British Pound",      pairSymbol: "GBPUSD",   countryCode: "gb", inverse: false },
  { symbol: "AUD", name: "Australian Dollar",  pairSymbol: "AUDUSD",   countryCode: "au", inverse: false },
  { symbol: "CAD", name: "Canadian Dollar",    pairSymbol: "USDCAD",   countryCode: "ca", inverse: true  },
  { symbol: "CHF", name: "Swiss Franc",        pairSymbol: "USDCHF",   countryCode: "ch", inverse: true  },
  { symbol: "CNY", name: "Chinese Yuan",       pairSymbol: "USDCNY",   countryCode: "cn", inverse: true  },
  { symbol: "HKD", name: "Hong Kong Dollar",   pairSymbol: "USDHKD",   countryCode: "hk", inverse: true  },
  { symbol: "NZD", name: "New Zealand Dollar", pairSymbol: "NZDUSD",   countryCode: "nz", inverse: false },
];

export type FetchFmpCurrenciesOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
};

export function normalizeFmpCurrencies(payload: unknown): DashboardCurrency[] {
  const forexMap = new Map<string, FmpForexQuote>();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item.symbol === "string") {
        forexMap.set(item.symbol.toUpperCase(), item as FmpForexQuote);
      }
    }
  }

  return CURRENCY_DEFINITIONS.map((def, index) => {
    let rateVsUsd: number | null;
    let changePercent: number | null;

    if (def.pairSymbol === null) {
      rateVsUsd = 1;
      changePercent = 0;
    } else {
      const quote = forexMap.get(def.pairSymbol);
      if (!quote) {
        rateVsUsd = null;
        changePercent = null;
      } else {
        const rawRate = toFiniteNumber(quote.price);
        const rawChange = toFiniteNumber(quote.changesPercentage);
        if (def.inverse) {
          rateVsUsd = rawRate !== null && rawRate !== 0 ? 1 / rawRate : null;
          changePercent = rawChange !== null ? -rawChange : null;
        } else {
          rateVsUsd = rawRate;
          changePercent = rawChange;
        }
      }
    }

    return {
      id: `currency-${def.symbol.toLowerCase()}`,
      rank: index + 1,
      name: def.name,
      symbol: def.symbol,
      category: "Currency" as const,
      rateVsUsd,
      changePercent,
      logoUrl: `https://flagcdn.com/w40/${def.countryCode}.png`,
      fallbackLogoUrls: [`https://flagcdn.com/w80/${def.countryCode}.png`],
    };
  });
}

export async function fetchTopCurrenciesFromFmp(options: FetchFmpCurrenciesOptions = {}): Promise<DashboardCurrency[]> {
  const apiKey = options.apiKey ?? process.env.FMP_API_KEY ?? "demo";
  const baseUrl = options.baseUrl ?? process.env.FMP_BASE_URL ?? FMP_BASE_URL;

  const url = new URL(`${baseUrl}/quotes/forex`);
  url.searchParams.set("apikey", apiKey);

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });

  const normalized = normalizeFmpCurrencies(payload);

  const externalResolved = normalized.slice(1).filter((c) => c.rateVsUsd !== null).length;
  if (externalResolved === 0) {
    const shape = Array.isArray(payload) ? `array(${payload.length})` : typeof payload;
    throw new Error(`FMP forex returned no usable pairs (response was ${shape})`);
  }

  // Warn if most pairs are missing (partial data — won't throw but worth logging)
  if (externalResolved < 5) {
    console.warn(`[fmp] forex: only ${externalResolved} of 9 expected pairs resolved`);
  }

  return normalized;
}

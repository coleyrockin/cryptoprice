import { requestJsonWithRetry } from "../request";
import { toFiniteNumber, toLogoCandidates, toSafeString } from "../sanitize";
import type { DashboardStock } from "../types";

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

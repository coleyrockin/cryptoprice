import { requestJsonWithRetry } from "../request";
import { toFiniteNumber, toLogoCandidates, toSafeString } from "../sanitize";
import type { DashboardCrypto, DashboardNight } from "../types";

const COINPAPRIKA_BASE_URL = "https://api.coinpaprika.com";
const NIGHT_ID = "night-midnight2";

type CoinpaprikaUsdQuote = {
  price?: number | string;
  market_cap?: number | string;
  volume_24h?: number | string;
  percent_change_24h?: number | string;
  ath_price?: number | string;
  percent_from_price_ath?: number | string;
};

type CoinpaprikaTicker = {
  id?: string;
  rank?: number;
  name?: string;
  symbol?: string;
  quotes?: {
    USD?: CoinpaprikaUsdQuote;
  };
};

export type FetchCoinpaprikaOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  limit?: number;
};

function tickerLogoCandidates(id: string, symbol: string): string[] {
  return toLogoCandidates(
    `https://static.coinpaprika.com/coin/${id}/logo.png`,
    `https://cryptoicons.org/api/icon/${symbol.toLowerCase()}/200`,
    `https://cryptoicon-api.pages.dev/api/icon/${symbol.toLowerCase()}`,
  );
}

function normalizeSymbol(value: unknown): string {
  return toSafeString(value, "UNK").toUpperCase();
}

function normalizeCoinTicker(item: CoinpaprikaTicker, rank: number): DashboardCrypto | null {
  const id = toSafeString(item.id, "unknown-coin");
  const symbol = normalizeSymbol(item.symbol);

  if (!id || !symbol) {
    return null;
  }

  const usd = item.quotes?.USD ?? {};
  const logoCandidates = tickerLogoCandidates(id, symbol);
  const [logoUrl, ...fallbackLogoUrls] = logoCandidates;

  return {
    id,
    rank,
    name: toSafeString(item.name, symbol),
    symbol,
    category: "Crypto",
    priceUsd: toFiniteNumber(usd.price),
    marketCapUsd: toFiniteNumber(usd.market_cap),
    change24h: toFiniteNumber(usd.percent_change_24h),
    logoUrl: logoUrl ?? null,
    fallbackLogoUrls,
  };
}

export function normalizeCoinpaprikaCryptos(payload: unknown, limit = 10): DashboardCrypto[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => normalizeCoinTicker((entry ?? {}) as CoinpaprikaTicker, index + 1))
    .filter((entry): entry is DashboardCrypto => Boolean(entry))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function normalizeCoinpaprikaNight(payload: unknown): DashboardNight | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const item = payload as CoinpaprikaTicker;
  const id = toSafeString(item.id, NIGHT_ID);
  const symbol = normalizeSymbol(item.symbol || "NIGHT");
  const usd = item.quotes?.USD ?? {};

  const logoCandidates = tickerLogoCandidates(id, symbol);
  const [logoUrl, ...fallbackLogoUrls] = logoCandidates;

  return {
    id,
    name: toSafeString(item.name, "Midnight"),
    symbol,
    logoUrl: logoUrl ?? null,
    fallbackLogoUrls,
    priceUsd: toFiniteNumber(usd.price),
    marketCapUsd: toFiniteNumber(usd.market_cap),
    volume24hUsd: toFiniteNumber(usd.volume_24h),
    athPriceUsd: toFiniteNumber(usd.ath_price),
    change24h: toFiniteNumber(usd.percent_change_24h),
    percentFromAth: toFiniteNumber(usd.percent_from_price_ath),
  };
}

export async function fetchTopCryptosFromCoinpaprika(options: FetchCoinpaprikaOptions = {}): Promise<DashboardCrypto[]> {
  const limit = Math.max(1, Math.min(25, options.limit ?? 10));
  const baseUrl = options.baseUrl ?? process.env.COINPAPRIKA_BASE_URL ?? COINPAPRIKA_BASE_URL;

  const url = new URL(`${baseUrl}/v1/tickers`);
  url.searchParams.set("quotes", "USD");
  url.searchParams.set("limit", String(limit));

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });

  const normalized = normalizeCoinpaprikaCryptos(payload, limit);
  if (normalized.length === 0) {
    throw new Error("CoinPaprika returned no cryptos");
  }

  return normalized;
}

export async function fetchNightFromCoinpaprika(options: FetchCoinpaprikaOptions = {}): Promise<DashboardNight | null> {
  const baseUrl = options.baseUrl ?? process.env.COINPAPRIKA_BASE_URL ?? COINPAPRIKA_BASE_URL;

  const url = new URL(`${baseUrl}/v1/tickers/${NIGHT_ID}`);
  url.searchParams.set("quotes", "USD");

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });

  return normalizeCoinpaprikaNight(payload);
}

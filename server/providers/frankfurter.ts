import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber } from "../sanitize.js";
import type { DashboardCurrency } from "../types.js";

const FRANKFURTER_BASE_URL = "https://api.frankfurter.app";

type CurrencyDef = {
  symbol: string;
  name: string;
  countryCode: string;
};

const CURRENCY_DEFINITIONS: CurrencyDef[] = [
  { symbol: "USD", name: "US Dollar",          countryCode: "us" },
  { symbol: "EUR", name: "Euro",               countryCode: "eu" },
  { symbol: "JPY", name: "Japanese Yen",       countryCode: "jp" },
  { symbol: "GBP", name: "British Pound",      countryCode: "gb" },
  { symbol: "AUD", name: "Australian Dollar",  countryCode: "au" },
  { symbol: "CAD", name: "Canadian Dollar",    countryCode: "ca" },
  { symbol: "CHF", name: "Swiss Franc",        countryCode: "ch" },
  { symbol: "CNY", name: "Chinese Yuan",       countryCode: "cn" },
  { symbol: "HKD", name: "Hong Kong Dollar",   countryCode: "hk" },
  { symbol: "NZD", name: "New Zealand Dollar", countryCode: "nz" },
];

const FOREIGN_SYMBOLS = CURRENCY_DEFINITIONS
  .filter((c) => c.symbol !== "USD")
  .map((c) => c.symbol)
  .join(",");

type FrankfurterResponse = {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

export type FetchFrankfurterOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
};

export function normalizeFrankfurterCurrencies(
  todayRates: Record<string, number>,
  yesterdayRates: Record<string, number>,
): DashboardCurrency[] {
  return CURRENCY_DEFINITIONS.map((def, index) => {
    let rateVsUsd: number | null;
    let changePercent: number | null;

    if (def.symbol === "USD") {
      rateVsUsd = 1;
      changePercent = 0;
    } else {
      const today = toFiniteNumber(todayRates[def.symbol]);
      const yesterday = toFiniteNumber(yesterdayRates[def.symbol]);

      // Frankfurter gives "X units per 1 USD", so rateVsUsd = 1 / rate
      rateVsUsd = today !== null && today > 0 ? 1 / today : null;

      if (today !== null && today > 0 && yesterday !== null && yesterday > 0) {
        const todayUsd = 1 / today;
        const yesterdayUsd = 1 / yesterday;
        changePercent = ((todayUsd - yesterdayUsd) / yesterdayUsd) * 100;
      } else {
        changePercent = null;
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

function yesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchTopCurrenciesFromFrankfurter(
  options: FetchFrankfurterOptions = {},
): Promise<DashboardCurrency[]> {
  const baseUrl = options.baseUrl ?? FRANKFURTER_BASE_URL;
  const qs = `from=USD&to=${FOREIGN_SYMBOLS}`;

  const [todayData, yesterdayData] = await Promise.all([
    requestJsonWithRetry<FrankfurterResponse>(`${baseUrl}/latest?${qs}`, {
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    }),
    requestJsonWithRetry<FrankfurterResponse>(
      `${baseUrl}/${yesterdayDateString()}?${qs}`,
      { timeoutMs: options.timeoutMs, retries: options.retries },
    ),
  ]);

  const todayRates = todayData.rates ?? {};
  const yesterdayRates = yesterdayData.rates ?? {};

  const normalized = normalizeFrankfurterCurrencies(todayRates, yesterdayRates);

  const liveCount = normalized.filter((c) => c.rateVsUsd !== null).length;
  if (liveCount < 2) {
    throw new Error(`Frankfurter returned insufficient currency data (${liveCount} live rates)`);
  }

  return normalized;
}

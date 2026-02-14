export type UsdQuote = {
  price: number;
  market_cap: number;
  volume_24h: number;
  percent_change_15m: number;
  percent_change_1h: number;
  percent_change_6h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  ath_price: number;
  percent_from_price_ath: number;
};

export type Ticker = {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  last_updated: string;
  quotes: {
    USD: UsdQuote;
  };
};

export type OhlcCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  time_open: string;
  time_close: string;
};

const API = {
  topTen: "https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=10",
  night: "https://api.coinpaprika.com/v1/tickers/night-midnight2?quotes=USD",
  nightRange: "https://api.coinpaprika.com/v1/coins/night-midnight2/ohlcv/latest?quote=usd",
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchTopTen(): Promise<Ticker[]> {
  const items = await getJson<Ticker[]>(API.topTen);

  return items
    .filter((item) => item?.quotes?.USD)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);
}

export async function fetchNight(): Promise<Ticker> {
  return getJson<Ticker>(API.night);
}

export async function fetchNightRange(): Promise<OhlcCandle | null> {
  const payload = await getJson<OhlcCandle[]>(API.nightRange);
  return payload[0] ?? null;
}

export type GlobalAsset = {
  rank: number;
  name: string;
  symbol: string;
  category: string;
  marketCap: number;
};

// Market caps approximate as of June 2025
const GLOBAL_ASSETS: GlobalAsset[] = [
  { rank: 1, name: "Gold", symbol: "XAU", category: "Commodity", marketCap: 16_100_000_000_000 },
  { rank: 2, name: "Apple", symbol: "AAPL", category: "Stock", marketCap: 3_400_000_000_000 },
  { rank: 3, name: "Microsoft", symbol: "MSFT", category: "Stock", marketCap: 3_100_000_000_000 },
  { rank: 4, name: "Saudi Aramco", symbol: "2222.SR", category: "Stock", marketCap: 1_800_000_000_000 },
  { rank: 5, name: "NVIDIA", symbol: "NVDA", category: "Stock", marketCap: 1_800_000_000_000 },
  { rank: 6, name: "Amazon", symbol: "AMZN", category: "Stock", marketCap: 1_700_000_000_000 },
  { rank: 7, name: "Alphabet", symbol: "GOOGL", category: "Stock", marketCap: 1_600_000_000_000 },
  { rank: 8, name: "Silver", symbol: "XAG", category: "Commodity", marketCap: 1_400_000_000_000 },
  { rank: 9, name: "Meta Platforms", symbol: "META", category: "Stock", marketCap: 1_300_000_000_000 },
  { rank: 10, name: "Bitcoin", symbol: "BTC", category: "Crypto", marketCap: 1_300_000_000_000 },
];

export function getGlobalAssets(): GlobalAsset[] {
  return GLOBAL_ASSETS;
}

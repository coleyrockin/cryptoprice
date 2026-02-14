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

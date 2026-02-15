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

const API = {
  topTen: "https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=10",
  night: "https://api.coinpaprika.com/v1/tickers/night-midnight2?quotes=USD",
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

export type GlobalAsset = {
  rank: number;
  name: string;
  symbol: string;
  category: string;
  marketCap: number;
  logoUrl?: string;
  fallbackLogoUrls?: string[];
};

export type StockAsset = {
  rank: number;
  name: string;
  symbol: string;
  marketCap: number;
  logoUrl?: string;
  fallbackLogoUrls?: string[];
};

// Market caps approximate as of June 2025
const GLOBAL_ASSETS: GlobalAsset[] = [
  {
    rank: 1,
    name: "Gold",
    symbol: "XAU",
    category: "Commodity",
    marketCap: 16_100_000_000_000,
    logoUrl: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f7e1.svg",
    fallbackLogoUrls: ["https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f947.svg"],
  },
  {
    rank: 2,
    name: "Apple",
    symbol: "AAPL",
    category: "Stock",
    marketCap: 3_400_000_000_000,
    logoUrl: "https://logo.clearbit.com/apple.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=apple.com&sz=128", "https://icons.duckduckgo.com/ip3/apple.com.ico"],
  },
  {
    rank: 3,
    name: "Microsoft",
    symbol: "MSFT",
    category: "Stock",
    marketCap: 3_100_000_000_000,
    logoUrl: "https://logo.clearbit.com/microsoft.com",
    fallbackLogoUrls: [
      "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
      "https://icons.duckduckgo.com/ip3/microsoft.com.ico",
    ],
  },
  {
    rank: 4,
    name: "Saudi Aramco",
    symbol: "2222.SR",
    category: "Stock",
    marketCap: 1_800_000_000_000,
    logoUrl: "https://logo.clearbit.com/aramco.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=aramco.com&sz=128", "https://icons.duckduckgo.com/ip3/aramco.com.ico"],
  },
  {
    rank: 5,
    name: "NVIDIA",
    symbol: "NVDA",
    category: "Stock",
    marketCap: 1_800_000_000_000,
    logoUrl: "https://logo.clearbit.com/nvidia.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=nvidia.com&sz=128", "https://icons.duckduckgo.com/ip3/nvidia.com.ico"],
  },
  {
    rank: 6,
    name: "Amazon",
    symbol: "AMZN",
    category: "Stock",
    marketCap: 1_700_000_000_000,
    logoUrl: "https://logo.clearbit.com/amazon.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=amazon.com&sz=128", "https://icons.duckduckgo.com/ip3/amazon.com.ico"],
  },
  {
    rank: 7,
    name: "Alphabet",
    symbol: "GOOGL",
    category: "Stock",
    marketCap: 1_600_000_000_000,
    logoUrl: "https://logo.clearbit.com/abc.xyz",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=abc.xyz&sz=128", "https://icons.duckduckgo.com/ip3/abc.xyz.ico"],
  },
  {
    rank: 8,
    name: "Silver",
    symbol: "XAG",
    category: "Commodity",
    marketCap: 1_400_000_000_000,
    logoUrl: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/26aa.svg",
    fallbackLogoUrls: ["https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f948.svg"],
  },
  {
    rank: 9,
    name: "Meta Platforms",
    symbol: "META",
    category: "Stock",
    marketCap: 1_300_000_000_000,
    logoUrl: "https://logo.clearbit.com/meta.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=meta.com&sz=128", "https://icons.duckduckgo.com/ip3/meta.com.ico"],
  },
  {
    rank: 10,
    name: "Bitcoin",
    symbol: "BTC",
    category: "Crypto",
    marketCap: 1_300_000_000_000,
    logoUrl: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png",
    fallbackLogoUrls: ["https://cryptoicons.org/api/icon/btc/200", "https://cryptoicon-api.pages.dev/api/icon/btc"],
  },
];

const TOP_STOCKS: StockAsset[] = [
  {
    rank: 1,
    name: "Apple",
    symbol: "AAPL",
    marketCap: 3_400_000_000_000,
    logoUrl: "https://logo.clearbit.com/apple.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=apple.com&sz=128", "https://icons.duckduckgo.com/ip3/apple.com.ico"],
  },
  {
    rank: 2,
    name: "Microsoft",
    symbol: "MSFT",
    marketCap: 3_100_000_000_000,
    logoUrl: "https://logo.clearbit.com/microsoft.com",
    fallbackLogoUrls: [
      "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128",
      "https://icons.duckduckgo.com/ip3/microsoft.com.ico",
    ],
  },
  {
    rank: 3,
    name: "NVIDIA",
    symbol: "NVDA",
    marketCap: 1_800_000_000_000,
    logoUrl: "https://logo.clearbit.com/nvidia.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=nvidia.com&sz=128", "https://icons.duckduckgo.com/ip3/nvidia.com.ico"],
  },
  {
    rank: 4,
    name: "Saudi Aramco",
    symbol: "2222.SR",
    marketCap: 1_800_000_000_000,
    logoUrl: "https://logo.clearbit.com/aramco.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=aramco.com&sz=128", "https://icons.duckduckgo.com/ip3/aramco.com.ico"],
  },
  {
    rank: 5,
    name: "Amazon",
    symbol: "AMZN",
    marketCap: 1_700_000_000_000,
    logoUrl: "https://logo.clearbit.com/amazon.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=amazon.com&sz=128", "https://icons.duckduckgo.com/ip3/amazon.com.ico"],
  },
  {
    rank: 6,
    name: "Alphabet",
    symbol: "GOOGL",
    marketCap: 1_600_000_000_000,
    logoUrl: "https://logo.clearbit.com/abc.xyz",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=abc.xyz&sz=128", "https://icons.duckduckgo.com/ip3/abc.xyz.ico"],
  },
  {
    rank: 7,
    name: "Meta Platforms",
    symbol: "META",
    marketCap: 1_300_000_000_000,
    logoUrl: "https://logo.clearbit.com/meta.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=meta.com&sz=128", "https://icons.duckduckgo.com/ip3/meta.com.ico"],
  },
  {
    rank: 8,
    name: "Berkshire Hathaway",
    symbol: "BRK.B",
    marketCap: 950_000_000_000,
    logoUrl: "https://logo.clearbit.com/berkshirehathaway.com",
    fallbackLogoUrls: [
      "https://www.google.com/s2/favicons?domain=berkshirehathaway.com&sz=128",
      "https://icons.duckduckgo.com/ip3/berkshirehathaway.com.ico",
    ],
  },
  {
    rank: 9,
    name: "Taiwan Semiconductor",
    symbol: "TSM",
    marketCap: 900_000_000_000,
    logoUrl: "https://logo.clearbit.com/tsmc.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=tsmc.com&sz=128", "https://icons.duckduckgo.com/ip3/tsmc.com.ico"],
  },
  {
    rank: 10,
    name: "Broadcom",
    symbol: "AVGO",
    marketCap: 850_000_000_000,
    logoUrl: "https://logo.clearbit.com/broadcom.com",
    fallbackLogoUrls: ["https://www.google.com/s2/favicons?domain=broadcom.com&sz=128", "https://icons.duckduckgo.com/ip3/broadcom.com.ico"],
  },
];

export function getGlobalAssets(): GlobalAsset[] {
  return GLOBAL_ASSETS;
}

export function getTopStocks(): StockAsset[] {
  return TOP_STOCKS;
}

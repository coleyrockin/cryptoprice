export type DashboardSource = {
  equities: "fmp";
  crypto: "coinpaprika";
  fallbackUsed: boolean;
};

export type DashboardEntryBase = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
};

export type DashboardCrypto = DashboardEntryBase & {
  category: "Crypto";
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
};

export type DashboardStock = DashboardEntryBase & {
  category: "Stock";
  marketCapUsd: number | null;
  priceUsd: number | null;
  changePercent: number | null;
};

export type DashboardAsset = DashboardEntryBase & {
  category: "Stock" | "Crypto" | "Commodity";
  marketCapUsd: number | null;
};

export type DashboardNight = {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  athPriceUsd: number | null;
  change24h: number | null;
  percentFromAth: number | null;
};

export type DashboardPayload = {
  generatedAt: string;
  stale: boolean;
  refreshInSec: number;
  source: DashboardSource;
  topCryptos: DashboardCrypto[];
  topStocks: DashboardStock[];
  topAssets: DashboardAsset[];
  night: DashboardNight | null;
};

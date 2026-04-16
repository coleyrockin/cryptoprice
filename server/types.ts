export type DashboardSource = {
  equities: string;
  crypto: "coinpaprika";
  fallbackUsed: boolean;
};

export type DashboardSegmentKey = "topCryptos" | "topStocks" | "topEtfs" | "topCurrencies" | "night";

export type DashboardSegmentSource = "live" | "fresh-cache" | "stale-cache" | "fallback" | "durable-cache";

export type DashboardSegmentMeta = {
  source: DashboardSegmentSource;
  ageSec: number;
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
  sparkline7d: number[];
};

export type DashboardStock = DashboardEntryBase & {
  category: "Stock";
  marketCapUsd: number | null;
  priceUsd: number | null;
  changePercent: number | null;
};

export type DashboardEtf = DashboardEntryBase & {
  category: "ETF";
  aumUsd: number | null;
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

export type DashboardCurrency = DashboardEntryBase & {
  category: "Currency";
  rateVsUsd: number | null;
  changePercent: number | null;
};

export type DashboardPayload = {
  generatedAt: string;
  stale: boolean;
  refreshInSec: number;
  source: DashboardSource;
  degradedSegments: DashboardSegmentKey[];
  segmentMeta: Record<DashboardSegmentKey, DashboardSegmentMeta>;
  topCryptos: DashboardCrypto[];
  topStocks: DashboardStock[];
  topEtfs: DashboardEtf[];
  topCurrencies: DashboardCurrency[];
  topAssets: DashboardAsset[];
  night: DashboardNight | null;
  requestId?: string;
};

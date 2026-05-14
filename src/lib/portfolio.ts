import type { DashboardCrypto, DashboardEtf, DashboardNight, DashboardStock, LocalHolding } from "../types/dashboard";

export type PortfolioEntry = DashboardCrypto | DashboardEtf | DashboardStock | (DashboardNight & { category: "NIGHT"; rank: number });

export type PortfolioPosition = {
  holding: LocalHolding;
  asset: PortfolioEntry | null;
  quantity: number;
  unitPriceUsd: number | null;
  currentValueUsd: number | null;
  costBasisUsd: number | null;
  gainLossUsd: number | null;
  allocationPercent: number | null;
};

export type PortfolioSummary = {
  totalValueUsd: number;
  totalCostBasisUsd: number | null;
  totalGainLossUsd: number | null;
  positions: PortfolioPosition[];
};

export function isTradablePortfolioAsset(value: unknown): value is PortfolioEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PortfolioEntry>;
  return entry.category === "Stock" || entry.category === "ETF" || entry.category === "Crypto" || entry.category === "NIGHT";
}

export function parsePositiveDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseOptionalMoney(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  return parsePositiveDecimal(value);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseStoredHoldings(raw: string | null): LocalHolding[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): LocalHolding | null => {
        if (!item || typeof item !== "object") return null;
        const assetId = safeString(item.assetId);
        const quantity = safeString(item.quantity);
        const createdAt = safeString(item.createdAt);
        const updatedAt = safeString(item.updatedAt);
        const costBasisUsd = safeString(item.costBasisUsd) ?? undefined;
        if (!assetId || !quantity || !createdAt || !updatedAt || !parsePositiveDecimal(quantity)) return null;
        if (costBasisUsd && !parsePositiveDecimal(costBasisUsd)) return null;
        return { assetId, quantity, costBasisUsd, createdAt, updatedAt };
      })
      .filter((holding): holding is LocalHolding => holding !== null);
  } catch {
    return [];
  }
}

export function unitPriceForAsset(asset: PortfolioEntry): number | null {
  if ("priceUsd" in asset && typeof asset.priceUsd === "number" && Number.isFinite(asset.priceUsd)) return asset.priceUsd;
  return null;
}

export function buildPortfolioSummary(holdings: readonly LocalHolding[], assets: ReadonlyMap<string, PortfolioEntry>): PortfolioSummary {
  const positions = holdings.map((holding): PortfolioPosition => {
    const asset = assets.get(holding.assetId) ?? null;
    const quantity = parsePositiveDecimal(holding.quantity) ?? 0;
    const unitPriceUsd = asset ? unitPriceForAsset(asset) : null;
    const currentValueUsd = unitPriceUsd === null ? null : unitPriceUsd * quantity;
    const costBasisUsd = parseOptionalMoney(holding.costBasisUsd);
    return {
      holding,
      asset,
      quantity,
      unitPriceUsd,
      currentValueUsd,
      costBasisUsd,
      gainLossUsd: currentValueUsd !== null && costBasisUsd !== null ? currentValueUsd - costBasisUsd : null,
      allocationPercent: null,
    };
  });

  const totalValueUsd = positions.reduce((sum, position) => sum + (position.currentValueUsd ?? 0), 0);
  const totalCostBasisUsd = positions.some((position) => position.costBasisUsd !== null)
    ? positions.reduce((sum, position) => sum + (position.costBasisUsd ?? 0), 0)
    : null;

  return {
    totalValueUsd,
    totalCostBasisUsd,
    totalGainLossUsd: totalCostBasisUsd === null ? null : totalValueUsd - totalCostBasisUsd,
    positions: positions.map((position) => ({
      ...position,
      allocationPercent: position.currentValueUsd !== null && totalValueUsd > 0 ? (position.currentValueUsd / totalValueUsd) * 100 : null,
    })),
  };
}

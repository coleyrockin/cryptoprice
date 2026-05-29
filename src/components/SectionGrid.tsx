import clsx from "clsx";
import { memo, type ReactNode } from "react";

import { MarketCard } from "./MarketCard";
import { SectionHeader } from "./SectionHeader";
import { buildPriceTitle, type SectionId } from "../lib/dashboard-filters";
import { getEntryChange, type DashboardEntry } from "../lib/dashboard-insights";
import {
  formatCompactCurrency,
  formatCurrency,
  formatExactCurrency,
  formatExactNumber,
  formatPercent,
  trendClass,
} from "../lib/formatters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardSegmentMeta,
  DashboardStock,
} from "../types/dashboard";

export type SectionVariant = "assets" | "stocks" | "private" | "etfs" | "currencies" | "cryptos";

type SkeletonGridProps = { count?: number };

export function SkeletonGrid({ count = 15 }: SkeletonGridProps) {
  return (
    <div className="coin-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article key={`skeleton-${index}`} className="coin-card skeleton-card">
          <span className="skeleton-line skeleton-line-sm" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-line-lg" />
          <span className="skeleton-line skeleton-line-sm" />
        </article>
      ))}
    </div>
  );
}

type CommonProps = {
  id: SectionId;
  surfaceClass: string;
  title: string;
  subtitle: string;
  meta?: DashboardSegmentMeta;
  generatedAt: string | undefined;
  isBooting: boolean;
  totalCount: number;
  normalizedSearchTerm: string;
  emptyLabel: string;
  pinnedIdSet: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  selectedAssetId: string | null;
  onOpenAssetDetail: (id: string) => void;
  footerNote?: string;
};

type SectionGridProps = CommonProps &
  (
    | { variant: "assets"; visibleEntries: readonly DashboardAsset[] }
    | { variant: "stocks"; visibleEntries: readonly DashboardStock[] }
    | { variant: "private"; visibleEntries: readonly DashboardPrivateCompany[] }
    | { variant: "etfs"; visibleEntries: readonly DashboardEtf[] }
    | { variant: "currencies"; visibleEntries: readonly DashboardCurrency[] }
    | {
        variant: "cryptos";
        visibleEntries: readonly DashboardCrypto[];
        activeCryptoId: string;
        /** Stable handler that both activates the crypto and opens its detail drawer. */
        onCryptoSelect: (id: string) => void;
      }
  );

export const SectionGrid = memo(function SectionGrid(props: SectionGridProps) {
  const {
    id,
    surfaceClass,
    title,
    subtitle,
    meta,
    generatedAt,
    isBooting,
    totalCount,
    normalizedSearchTerm,
    emptyLabel,
    footerNote,
  } = props;

  return (
    <section id={id} className={clsx("surface", surfaceClass)}>
      <SectionHeader title={title} subtitle={subtitle} meta={meta} generatedAt={generatedAt} />
      {renderBody(props, isBooting, totalCount, normalizedSearchTerm, emptyLabel)}
      {footerNote ? <p className="disclaimer">{footerNote}</p> : null}
    </section>
  );
});

function renderBody(
  props: SectionGridProps,
  isBooting: boolean,
  totalCount: number,
  normalizedSearchTerm: string,
  emptyLabel: string,
): ReactNode {
  if (isBooting) return <SkeletonGrid />;
  if (!totalCount || !props.visibleEntries.length) {
    return renderEmptyState(emptyLabel, totalCount > 0, normalizedSearchTerm);
  }

  switch (props.variant) {
    case "assets":
      return <div className="coin-grid">{props.visibleEntries.map((asset, index) => renderAssetCard(asset, index, props))}</div>;
    case "stocks":
      return <div className="coin-grid">{props.visibleEntries.map((stock, index) => renderStockCard(stock, index, props))}</div>;
    case "private":
      return <div className="coin-grid">{props.visibleEntries.map((company, index) => renderPrivateCard(company, index, props))}</div>;
    case "etfs":
      return <div className="coin-grid">{props.visibleEntries.map((etf, index) => renderEtfCard(etf, index, props))}</div>;
    case "currencies":
      return <div className="coin-grid">{props.visibleEntries.map((currency, index) => renderCurrencyCard(currency, index, props))}</div>;
    case "cryptos":
      return (
        <div className="coin-grid">
          {props.visibleEntries.map((coin, index) =>
            renderCryptoCard(coin, index, props),
          )}
        </div>
      );
  }
}

function renderEmptyState(label: string, hasSourceData: boolean, normalizedSearchTerm: string): ReactNode {
  if (hasSourceData && normalizedSearchTerm) {
    return <p className="filter-empty">{`No ${label} match "${normalizedSearchTerm}".`}</p>;
  }
  return <p className="muted">No {label} data available.</p>;
}

type CardCommon = Pick<CommonProps, "pinnedIdSet" | "onTogglePin" | "generatedAt" | "selectedAssetId" | "onOpenAssetDetail">;

function renderAssetCard(asset: DashboardAsset, index: number, common: CardCommon): ReactNode {
  return (
    <MarketCard
      key={asset.id}
      id={asset.id}
      rank={asset.rank}
      name={asset.name}
      symbol={asset.symbol}
      meta={asset.category}
      valueLabel="Est. Market Cap"
      value={formatCompactCurrency(asset.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(asset.marketCapUsd), common.generatedAt, "Exact market cap (USD)")}
      secondary="Estimated market cap"
      secondaryClassName="asset-note"
      index={index}
      logoUrl={asset.logoUrl}
      fallbackLogoUrls={asset.fallbackLogoUrls}
      pinned={common.pinnedIdSet.has(asset.id)}
      onTogglePin={common.onTogglePin}
      assetStyle
      interactive
      active={asset.id === common.selectedAssetId}
      onSelect={common.onOpenAssetDetail}
    />
  );
}

function renderStockCard(stock: DashboardStock, index: number, common: CardCommon): ReactNode {
  const changeText = formatPercent(stock.changePercent);
  const hasChange = changeText !== "—";
  const priceText = stock.priceUsd === null
    ? "Curated market cap"
    : hasChange
      ? `${formatCurrency(stock.priceUsd)} · ${changeText}`
      : formatCurrency(stock.priceUsd);
  const priceTooltip = stock.priceUsd === null
    ? "Verified snapshot; no free live quote"
    : hasChange
      ? "Price and daily change"
      : "Unit price";

  return (
    <MarketCard
      key={stock.id}
      id={stock.id}
      rank={stock.rank}
      name={stock.name}
      symbol={stock.symbol}
      meta={stock.category}
      valueLabel="Market cap"
      value={formatCompactCurrency(stock.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(stock.marketCapUsd), common.generatedAt, "Exact market cap (USD)")}
      secondary={priceText}
      secondaryClassName={hasChange ? clsx("coin-change", trendClass(stock.changePercent)) : "asset-note"}
      secondaryTitle={priceTooltip}
      index={index}
      logoUrl={stock.logoUrl}
      fallbackLogoUrls={stock.fallbackLogoUrls}
      pinned={common.pinnedIdSet.has(stock.id)}
      onTogglePin={common.onTogglePin}
      assetStyle
      interactive
      active={stock.id === common.selectedAssetId}
      onSelect={common.onOpenAssetDetail}
    />
  );
}

function renderPrivateCard(company: DashboardPrivateCompany, index: number, common: CardCommon): ReactNode {
  return (
    <MarketCard
      key={company.id}
      id={company.id}
      rank={company.rank}
      name={company.name}
      symbol={company.symbol}
      meta={company.category}
      valueLabel="Valuation"
      value={formatCompactCurrency(company.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(company.marketCapUsd), common.generatedAt, "Exact valuation (USD)")}
      secondary="Curated estimate"
      secondaryClassName="asset-note"
      index={index}
      logoUrl={company.logoUrl}
      fallbackLogoUrls={company.fallbackLogoUrls}
      pinned={common.pinnedIdSet.has(company.id)}
      onTogglePin={common.onTogglePin}
      assetStyle
      interactive
      active={company.id === common.selectedAssetId}
      onSelect={common.onOpenAssetDetail}
    />
  );
}

function renderEtfCard(etf: DashboardEtf, index: number, common: CardCommon): ReactNode {
  const changeText = formatPercent(etf.changePercent);
  const hasChange = changeText !== "—";
  // ETFs are ranked by fund size (AUM), so AUM is the headline value — mirroring
  // how stock cards lead with market cap — with unit price + daily change beneath.
  const priceText = etf.priceUsd === null
    ? (hasChange ? changeText : "—")
    : hasChange
      ? `${formatCurrency(etf.priceUsd)} · ${changeText}`
      : formatCurrency(etf.priceUsd);
  const priceTooltip = etf.priceUsd === null
    ? (hasChange ? "Daily change" : undefined)
    : hasChange
      ? "Unit price and daily change"
      : "Unit price";

  return (
    <MarketCard
      key={etf.id}
      id={etf.id}
      rank={etf.rank}
      name={etf.name}
      symbol={etf.symbol}
      meta={etf.category}
      valueLabel="AUM"
      value={formatCompactCurrency(etf.aumUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(etf.aumUsd), common.generatedAt, "Exact AUM (USD)")}
      secondary={priceText}
      secondaryClassName={hasChange ? clsx("coin-change", trendClass(etf.changePercent)) : "asset-note"}
      secondaryTitle={priceTooltip}
      index={index}
      logoUrl={etf.logoUrl}
      fallbackLogoUrls={etf.fallbackLogoUrls}
      pinned={common.pinnedIdSet.has(etf.id)}
      onTogglePin={common.onTogglePin}
      assetStyle
      interactive
      active={etf.id === common.selectedAssetId}
      onSelect={common.onOpenAssetDetail}
    />
  );
}

function renderCurrencyCard(currency: DashboardCurrency, index: number, common: CardCommon): ReactNode {
  return (
    <MarketCard
      key={currency.id}
      id={currency.id}
      rank={currency.rank}
      name={currency.name}
      symbol={currency.symbol}
      meta={currency.category}
      valueLabel="Rate vs USD"
      value={formatCurrency(currency.rateVsUsd)}
      priceTitle={buildPriceTitle(formatExactCurrency(currency.rateVsUsd), common.generatedAt, "Exact rate")}
      secondary={formatPercent(currency.changePercent)}
      secondaryClassName={clsx("coin-change", trendClass(currency.changePercent))}
      secondaryTitle="Daily change"
      index={index}
      logoUrl={currency.logoUrl}
      fallbackLogoUrls={currency.fallbackLogoUrls}
      pinned={common.pinnedIdSet.has(currency.id)}
      onTogglePin={common.onTogglePin}
      assetStyle
      interactive
      active={currency.id === common.selectedAssetId}
      onSelect={common.onOpenAssetDetail}
    />
  );
}

function renderCryptoCard(
  coin: DashboardCrypto,
  index: number,
  props: Extract<SectionGridProps, { variant: "cryptos" }>,
): ReactNode {
  return (
    <MarketCard
      key={coin.id}
      id={coin.id}
      rank={coin.rank}
      name={coin.name}
      symbol={coin.symbol}
      meta={coin.category}
      value={formatCurrency(coin.priceUsd)}
      priceTitle={buildPriceTitle(formatExactCurrency(coin.priceUsd), props.generatedAt)}
      secondary={formatPercent(coin.change24h)}
      secondaryClassName={clsx("coin-change", trendClass(coin.change24h))}
      secondaryTitle="24h change"
      index={index}
      logoUrl={coin.logoUrl}
      fallbackLogoUrls={coin.fallbackLogoUrls}
      pinned={props.pinnedIdSet.has(coin.id)}
      onTogglePin={props.onTogglePin}
      interactive
      active={coin.id === props.activeCryptoId || coin.id === props.selectedAssetId}
      onSelect={props.onCryptoSelect}
      sparkline={coin.sparkline7d}
    />
  );
}

type PinnedCardProps = {
  entry: DashboardEntry;
  index: number;
  pinnedIdSet: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  generatedAt: string | undefined;
  selectedAssetId: string | null;
  onOpenAssetDetail: (id: string) => void;
};

/**
 * Render a single pinned-watchlist card. Pinned cards are rendered outside
 * SectionGrid because their value/secondary varies per underlying entry kind.
 */
export const PinnedCard = memo(function PinnedCard({
  entry,
  index,
  pinnedIdSet,
  onTogglePin,
  generatedAt,
  selectedAssetId,
  onOpenAssetDetail,
}: PinnedCardProps) {
  const change = getEntryChange(entry);
  const changeText = formatPercent(change);
  const hasChange = changeText !== "—";
  const isCrypto = "sparkline7d" in entry;
  const isCurrency = "rateVsUsd" in entry;
  const isPrivateCompany = entry.category === "Private Company";
  const isPricedAsset = "priceUsd" in entry;

  const valueLabel = isCrypto
    ? undefined
    : isCurrency
      ? "Rate vs USD"
      : isPricedAsset
        ? "Price"
        : isPrivateCompany
          ? "Est. Valuation"
          : "Est. Market Cap";
  const value = isCurrency
    ? formatCurrency(entry.rateVsUsd)
    : isPricedAsset
      ? formatCurrency(entry.priceUsd)
      : formatCompactCurrency(entry.marketCapUsd);
  const exactValue = isCurrency
    ? formatExactCurrency(entry.rateVsUsd)
    : isPrivateCompany
      ? formatExactCurrency(entry.marketCapUsd)
      : isPricedAsset
        ? formatExactCurrency(entry.priceUsd)
        : formatExactNumber(entry.marketCapUsd);

  return (
    <MarketCard
      id={entry.id}
      rank={entry.rank}
      name={entry.name}
      symbol={entry.symbol}
      meta={entry.category}
      valueLabel={valueLabel}
      value={value}
      priceTitle={buildPriceTitle(
        exactValue,
        generatedAt,
        isCurrency ? "Exact rate" : isPricedAsset ? "Exact" : isPrivateCompany ? "Exact valuation (USD)" : "Exact market cap (USD)",
      )}
      secondary={
        isCrypto
          ? changeText
          : hasChange
            ? changeText
            : isPricedAsset || isCurrency
              ? "—"
              : isPrivateCompany
                ? "Curated estimate"
                : "Estimated market cap"
      }
      secondaryClassName={isCrypto || hasChange ? clsx("coin-change", trendClass(change)) : "asset-note"}
      secondaryTitle={isCrypto ? "24h change" : hasChange ? "Daily change" : undefined}
      index={index}
      logoUrl={entry.logoUrl}
      fallbackLogoUrls={entry.fallbackLogoUrls}
      pinned={pinnedIdSet.has(entry.id)}
      onTogglePin={onTogglePin}
      sparkline={isCrypto ? entry.sparkline7d : undefined}
      assetStyle={!isCrypto}
      interactive
      active={entry.id === selectedAssetId}
      onSelect={onOpenAssetDetail}
    />
  );
});

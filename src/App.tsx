import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchDashboard } from "./api";
import { LogoMark } from "./components/LogoMark";
import { MarketCard } from "./components/MarketCard";
import { SectionHeader } from "./components/SectionHeader";
import {
  buildDashboardInsights,
  dashboardEntryMatches,
  getEntryChange,
  nightAsPinnedEntry,
  sortDashboardEntries,
  type DashboardEntry,
  type DashboardSortMode,
} from "./lib/dashboard-insights";
import { formatCompactCurrency, formatCurrency, formatExactCurrency, formatExactNumber, formatPercent, trendClass } from "./lib/formatters";
import { useTheme } from "./hooks/useTheme";
import type { DashboardAsset, DashboardCrypto, DashboardCurrency, DashboardEtf, DashboardStock } from "./types/dashboard";

const SECTION_IDS = ["section-watchlist", "section-assets", "section-stocks", "section-etfs", "section-currencies", "section-cryptos", "section-night"] as const;

type SectionFilter = "all" | "assets" | "stocks" | "etfs" | "currencies" | "cryptos";
type DensityMode = "comfortable" | "compact";

const SECTION_FILTERS: { value: SectionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assets", label: "Assets" },
  { value: "stocks", label: "Stocks" },
  { value: "etfs", label: "ETFs" },
  { value: "currencies", label: "FX" },
  { value: "cryptos", label: "Crypto" },
];

const SORT_OPTIONS: { value: DashboardSortMode; label: string }[] = [
  { value: "rank", label: "Rank" },
  { value: "name", label: "Name" },
  { value: "value", label: "Value" },
  { value: "movement", label: "Move" },
];

const SECTION_LINKS: { id: (typeof SECTION_IDS)[number]; label: string; filter: SectionFilter | "watchlist" }[] = [
  { id: "section-watchlist", label: "Watchlist", filter: "watchlist" },
  { id: "section-assets", label: "Global Assets", filter: "assets" },
  { id: "section-stocks", label: "Stocks", filter: "stocks" },
  { id: "section-etfs", label: "ETFs", filter: "etfs" },
  { id: "section-currencies", label: "Currencies", filter: "currencies" },
  { id: "section-cryptos", label: "Cryptos", filter: "cryptos" },
  { id: "section-night", label: "NIGHT", filter: "all" },
];

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const DEFAULT_REFRESH_SEC = 30;
const PINNED_STORAGE_KEY = "wap.pinned-markets.v1";

function buildPriceTitle(exact: string, generatedAt: string | undefined, prefix = "Exact"): string {
  const stamp = generatedAt ? new Date(generatedAt).toLocaleString() : "live";
  return `${prefix}: ${exact} · Updated ${stamp}`;
}

function readStoredPinnedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredPinnedIds(ids: readonly string[]) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore private browsing / quota failures.
  }
}

const EMPTY_CRYPTOS: DashboardCrypto[] = [];
const EMPTY_STOCKS: DashboardStock[] = [];
const EMPTY_ETFS: DashboardEtf[] = [];
const EMPTY_CURRENCIES: DashboardCurrency[] = [];
const EMPTY_ASSETS: DashboardAsset[] = [];

function SkeletonGrid({ count = 10 }: { count?: number }) {
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

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeCryptoId, setActiveCryptoId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
  const [sortMode, setSortMode] = useState<DashboardSortMode>("rank");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [pinnedIds, setPinnedIds] = useState<string[]>(readStoredPinnedIds);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupSectionObserver = useCallback(() => {
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-15% 0px -50% 0px" },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    observerRef.current = observer;
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return setupSectionObserver();
  }, [setupSectionObserver]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const refreshInSec = query.state.data?.refreshInSec ?? DEFAULT_REFRESH_SEC;
      return refreshInSec * 1_000;
    },
  });

  const dashboard = dashboardQuery.data;
  const topCryptos = dashboard?.topCryptos ?? EMPTY_CRYPTOS;
  const topStocks = dashboard?.topStocks ?? EMPTY_STOCKS;
  const topEtfs = dashboard?.topEtfs ?? EMPTY_ETFS;
  const topCurrencies = dashboard?.topCurrencies ?? EMPTY_CURRENCIES;
  const topAssets = dashboard?.topAssets ?? EMPTY_ASSETS;
  const night = dashboard?.night ?? null;
  const segmentMeta = dashboard?.segmentMeta;
  const generatedAt = dashboard?.generatedAt;
  const normalizedSearchTerm = searchTerm.trim();
  const isBooting = dashboardQuery.isPending && !dashboard;

  useEffect(() => {
    if (topCryptos.length === 0) {
      if (activeCryptoId) setActiveCryptoId("");
      return;
    }

    if (!topCryptos.some((coin) => coin.id === activeCryptoId)) {
      setActiveCryptoId(topCryptos[0].id);
    }
  }, [activeCryptoId, topCryptos]);

  useEffect(() => {
    writeStoredPinnedIds(pinnedIds);
  }, [pinnedIds]);

  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const togglePinned = useCallback((id: string) => {
    setPinnedIds((current) => (current.includes(id) ? current.filter((pinnedId) => pinnedId !== id) : [id, ...current].slice(0, 12)));
  }, []);

  const dashboardInsights = useMemo(() => (dashboard ? buildDashboardInsights(dashboard) : []), [dashboard]);

  const visibleTopAssets = useMemo(
    () => sortDashboardEntries(topAssets.filter((entry) => dashboardEntryMatches(entry, normalizedSearchTerm)), sortMode),
    [normalizedSearchTerm, sortMode, topAssets],
  );
  const visibleTopStocks = useMemo(
    () => sortDashboardEntries(topStocks.filter((entry) => dashboardEntryMatches(entry, normalizedSearchTerm)), sortMode),
    [normalizedSearchTerm, sortMode, topStocks],
  );
  const visibleTopEtfs = useMemo(
    () => sortDashboardEntries(topEtfs.filter((entry) => dashboardEntryMatches(entry, normalizedSearchTerm)), sortMode),
    [normalizedSearchTerm, sortMode, topEtfs],
  );
  const visibleTopCurrencies = useMemo(
    () => sortDashboardEntries(topCurrencies.filter((entry) => dashboardEntryMatches(entry, normalizedSearchTerm)), sortMode),
    [normalizedSearchTerm, sortMode, topCurrencies],
  );
  const visibleTopCryptos = useMemo(
    () => sortDashboardEntries(topCryptos.filter((entry) => dashboardEntryMatches(entry, normalizedSearchTerm)), sortMode),
    [normalizedSearchTerm, sortMode, topCryptos],
  );

  const pinnedEntries = useMemo(() => {
    const byId = new Map<string, DashboardEntry>();
    for (const entry of [...topStocks, ...topEtfs, ...topCurrencies, ...topCryptos, ...topAssets]) {
      byId.set(entry.id, entry);
    }
    if (night) byId.set(night.id, nightAsPinnedEntry(night));
    return pinnedIds.map((id) => byId.get(id)).filter((entry): entry is DashboardEntry => Boolean(entry));
  }, [night, pinnedIds, topAssets, topCryptos, topCurrencies, topEtfs, topStocks]);

  const navLinks = useMemo(
    () =>
      SECTION_LINKS.filter((link) => {
        if (link.filter === "watchlist") return pinnedEntries.length > 0;
        if (link.id === "section-night") return sectionFilter === "all";
        return sectionFilter === "all" || link.filter === sectionFilter;
      }),
    [pinnedEntries.length, sectionFilter],
  );

  const shouldShowSection = useCallback((filter: Exclude<SectionFilter, "all">) => sectionFilter === "all" || sectionFilter === filter, [sectionFilter]);

  const renderEmptyState = (label: string, hasSourceData: boolean) => {
    if (hasSourceData && normalizedSearchTerm) {
      return <p className="filter-empty">No {label} match "{normalizedSearchTerm}".</p>;
    }

    return <p className="muted">No {label} data available.</p>;
  };

  const renderPinnedCard = (entry: DashboardEntry, index: number) => {
    const change = getEntryChange(entry);
    const changeText = formatPercent(change);
    const hasChange = changeText !== "—";
    const isCrypto = "sparkline7d" in entry;
    const isCurrency = "rateVsUsd" in entry;
    const isPricedAsset = "priceUsd" in entry;

    const valueLabel = isCrypto ? undefined : isCurrency ? "Rate vs USD" : isPricedAsset ? "Price" : "Est. Market Cap";
    const value = isCurrency
      ? formatCurrency(entry.rateVsUsd)
      : isPricedAsset
        ? formatCurrency(entry.priceUsd)
        : formatCompactCurrency(entry.marketCapUsd);
    const exactValue = isCurrency
      ? formatExactCurrency(entry.rateVsUsd)
      : isPricedAsset
        ? formatExactCurrency(entry.priceUsd)
        : formatExactNumber(entry.marketCapUsd);

    return (
      <MarketCard
        key={`pinned-${entry.id}`}
        id={entry.id}
        rank={entry.rank}
        name={entry.name}
        symbol={entry.symbol}
        meta={entry.category}
        valueLabel={valueLabel}
        value={value}
        priceTitle={buildPriceTitle(exactValue, generatedAt, isCurrency ? "Exact rate" : isPricedAsset ? "Exact" : "Exact market cap (USD)")}
        secondary={isCrypto ? changeText : hasChange ? changeText : isPricedAsset || isCurrency ? "—" : "Estimated market cap"}
        secondaryClassName={isCrypto || hasChange ? clsx("coin-change", trendClass(change)) : "asset-note"}
        secondaryTitle={isCrypto ? "24h change" : hasChange ? "Daily change" : undefined}
        index={index}
        logoUrl={entry.logoUrl}
        fallbackLogoUrls={entry.fallbackLogoUrls}
        pinned={pinnedIdSet.has(entry.id)}
        onTogglePin={() => togglePinned(entry.id)}
        sparkline={isCrypto ? entry.sparkline7d : undefined}
        assetStyle={!isCrypto}
      />
    );
  };

  const renderCryptoGrid = () => {
    if (isBooting) return <SkeletonGrid />;
    if (!topCryptos.length || !visibleTopCryptos.length) return renderEmptyState("cryptocurrencies", topCryptos.length > 0);

    return (
      <div className="coin-grid">
        {visibleTopCryptos.map((coin, index) => (
          <MarketCard
            key={coin.id}
            id={coin.id}
            rank={coin.rank}
            name={coin.name}
            symbol={coin.symbol}
            meta={coin.category}
            value={formatCurrency(coin.priceUsd)}
            priceTitle={buildPriceTitle(formatExactCurrency(coin.priceUsd), generatedAt)}
            secondary={formatPercent(coin.change24h)}
            secondaryClassName={clsx("coin-change", trendClass(coin.change24h))}
            secondaryTitle="24h change"
            index={index}
            logoUrl={coin.logoUrl}
            fallbackLogoUrls={coin.fallbackLogoUrls}
            pinned={pinnedIdSet.has(coin.id)}
            onTogglePin={() => togglePinned(coin.id)}
            interactive
            active={coin.id === activeCryptoId}
            onClick={() => setActiveCryptoId(coin.id)}
            sparkline={coin.sparkline7d}
          />
        ))}
      </div>
    );
  };

  const renderStockGrid = () => {
    if (isBooting) return <SkeletonGrid />;
    if (!topStocks.length || !visibleTopStocks.length) return renderEmptyState("stocks", topStocks.length > 0);

    return (
      <div className="coin-grid">
        {visibleTopStocks.map((stock, index) => {
          const changeText = formatPercent(stock.changePercent);
          const hasChange = changeText !== "—";

          return (
            <MarketCard
              key={stock.id}
              id={stock.id}
              rank={stock.rank}
              name={stock.name}
              symbol={stock.symbol}
              meta={stock.category}
              valueLabel="Price"
              value={formatCurrency(stock.priceUsd)}
              priceTitle={buildPriceTitle(formatExactCurrency(stock.priceUsd), generatedAt)}
              secondary={hasChange ? changeText : "—"}
              secondaryClassName={hasChange ? clsx("coin-change", trendClass(stock.changePercent)) : "asset-note"}
              secondaryTitle={hasChange ? "Daily change" : undefined}
              index={index}
              logoUrl={stock.logoUrl}
              fallbackLogoUrls={stock.fallbackLogoUrls}
              pinned={pinnedIdSet.has(stock.id)}
              onTogglePin={() => togglePinned(stock.id)}
              assetStyle
            />
          );
        })}
      </div>
    );
  };

  const renderEtfGrid = () => {
    if (isBooting) return <SkeletonGrid />;
    if (!topEtfs.length || !visibleTopEtfs.length) return renderEmptyState("ETFs", topEtfs.length > 0);

    return (
      <div className="coin-grid">
        {visibleTopEtfs.map((etf, index) => {
          const changeText = formatPercent(etf.changePercent);
          const hasChange = changeText !== "—";

          return (
            <MarketCard
              key={etf.id}
              id={etf.id}
              rank={etf.rank}
              name={etf.name}
              symbol={etf.symbol}
              meta={etf.category}
              valueLabel="Price"
              value={formatCurrency(etf.priceUsd)}
              priceTitle={buildPriceTitle(formatExactCurrency(etf.priceUsd), generatedAt)}
              secondary={hasChange ? changeText : "—"}
              secondaryClassName={hasChange ? clsx("coin-change", trendClass(etf.changePercent)) : "asset-note"}
              secondaryTitle={hasChange ? "Daily change" : undefined}
              index={index}
              logoUrl={etf.logoUrl}
              fallbackLogoUrls={etf.fallbackLogoUrls}
              pinned={pinnedIdSet.has(etf.id)}
              onTogglePin={() => togglePinned(etf.id)}
              assetStyle
            />
          );
        })}
      </div>
    );
  };

  const renderCurrencyGrid = () => {
    if (isBooting) return <SkeletonGrid />;
    if (!topCurrencies.length || !visibleTopCurrencies.length) return renderEmptyState("currencies", topCurrencies.length > 0);

    return (
      <div className="coin-grid">
        {visibleTopCurrencies.map((currency, index) => (
          <MarketCard
            key={currency.id}
            id={currency.id}
            rank={currency.rank}
            name={currency.name}
            symbol={currency.symbol}
            meta={currency.category}
            valueLabel="Rate vs USD"
            value={formatCurrency(currency.rateVsUsd)}
            priceTitle={buildPriceTitle(formatExactCurrency(currency.rateVsUsd), generatedAt, "Exact rate")}
            secondary={formatPercent(currency.changePercent)}
            secondaryClassName={clsx("coin-change", trendClass(currency.changePercent))}
            secondaryTitle="Daily change"
            index={index}
            logoUrl={currency.logoUrl}
            fallbackLogoUrls={currency.fallbackLogoUrls}
            pinned={pinnedIdSet.has(currency.id)}
            onTogglePin={() => togglePinned(currency.id)}
            assetStyle
          />
        ))}
      </div>
    );
  };

  const renderAssetGrid = () => {
    if (isBooting) return <SkeletonGrid />;
    if (!topAssets.length || !visibleTopAssets.length) return renderEmptyState("global assets", topAssets.length > 0);

    return (
      <div className="coin-grid">
        {visibleTopAssets.map((asset, index) => (
          <MarketCard
            key={asset.id}
            id={asset.id}
            rank={asset.rank}
            name={asset.name}
            symbol={asset.symbol}
            meta={asset.category}
            valueLabel="Est. Market Cap"
            value={formatCompactCurrency(asset.marketCapUsd)}
            priceTitle={buildPriceTitle(formatExactNumber(asset.marketCapUsd), generatedAt, "Exact market cap (USD)")}
            secondary="Estimated market cap"
            secondaryClassName="asset-note"
            index={index}
            logoUrl={asset.logoUrl}
            fallbackLogoUrls={asset.fallbackLogoUrls}
            pinned={pinnedIdSet.has(asset.id)}
            onTogglePin={() => togglePinned(asset.id)}
            assetStyle
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <main className={clsx("shell", density === "compact" && "shell-compact")}>
        <header className="hero">
          <div className="hero-top-row">
            <p className="eyebrow">World Asset Prices</p>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
          <h1>
            Global Assets <span>Dashboard</span>
          </h1>
          <p className="tagline">Top global assets, stocks, ETFs, currencies, cryptocurrencies, and NIGHT price with faster market discovery.</p>
          {dashboardInsights.length ? (
            <dl className="hero-insights" aria-label="Dashboard highlights">
              {dashboardInsights.map((insight) => (
                <div key={insight.label} className={clsx("hero-insight", `hero-insight--${insight.tone}`)}>
                  <dt>{insight.label}</dt>
                  <dd>{insight.value}</dd>
                  <span>{insight.detail}</span>
                </div>
              ))}
            </dl>
          ) : null}
        </header>

        <section className="dashboard-toolbar" aria-label="Dashboard controls">
          <label className="market-search">
            <span>Search</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search markets"
              placeholder="BTC, Apple, ETF, currency..."
            />
          </label>

          <div className="control-cluster" aria-label="Section filter">
            {SECTION_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={clsx("segmented-button", sectionFilter === filter.value && "active")}
                onClick={() => setSectionFilter(filter.value)}
                aria-pressed={sectionFilter === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="market-select">
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as DashboardSortMode)} aria-label="Sort markets">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={clsx("density-toggle", density === "compact" && "active")}
            onClick={() => setDensity((current) => (current === "compact" ? "comfortable" : "compact"))}
            aria-pressed={density === "compact"}
          >
            {density === "compact" ? "Comfort" : "Compact"}
          </button>
        </section>

        <nav className="section-nav" aria-label="Dashboard sections">
          {navLinks.map((link) => (
            <a key={link.id} href={`#${link.id}`} className={clsx(activeSection === link.id && "nav-active")}>
              {link.label}
            </a>
          ))}
        </nav>

        {pinnedEntries.length ? (
          <motion.section id="section-watchlist" className="surface watchlist-surface" aria-labelledby="watchlist-heading" {...SECTION_REVEAL}>
            <div className="surface-head">
              <div className="surface-title-row">
                <h2 id="watchlist-heading">Pinned Watchlist</h2>
              </div>
              <div className="surface-head-meta">
                <p>{pinnedEntries.length} pinned market{pinnedEntries.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="coin-grid watchlist-grid">
              {pinnedEntries.map((entry, index) => renderPinnedCard(entry, index))}
            </div>
          </motion.section>
        ) : null}

        {shouldShowSection("assets") ? (
          <motion.section id="section-assets" className="surface global-assets-surface" {...SECTION_REVEAL}>
            <SectionHeader
              title="Top 10 Global Assets"
              subtitle="By estimated market cap"
              meta={segmentMeta?.topStocks}
              generatedAt={generatedAt}
            />
            {renderAssetGrid()}
            <p className="disclaimer">* Approximate values. Network/API conditions may delay updates.</p>
          </motion.section>
        ) : null}

        {shouldShowSection("stocks") ? (
          <motion.section id="section-stocks" className="surface stocks-surface" {...SECTION_REVEAL}>
            <SectionHeader
              title="Top 10 Stocks"
              subtitle="By estimated market cap"
              meta={segmentMeta?.topStocks}
              generatedAt={generatedAt}
            />
            {renderStockGrid()}
          </motion.section>
        ) : null}

        {shouldShowSection("etfs") ? (
          <motion.section id="section-etfs" className="surface etfs-surface" {...SECTION_REVEAL}>
            <SectionHeader
              title="Top 10 ETFs"
              subtitle="By assets under management"
              meta={segmentMeta?.topEtfs}
              generatedAt={generatedAt}
            />
            {renderEtfGrid()}
          </motion.section>
        ) : null}

        {shouldShowSection("currencies") ? (
          <motion.section id="section-currencies" className="surface currencies-surface" {...SECTION_REVEAL}>
            <SectionHeader
              title="Top 10 Currencies"
              subtitle="Exchange rates vs USD"
              meta={segmentMeta?.topCurrencies}
              generatedAt={generatedAt}
            />
            {renderCurrencyGrid()}
          </motion.section>
        ) : null}

        {shouldShowSection("cryptos") ? (
          <motion.section id="section-cryptos" className="surface cryptos-surface" {...SECTION_REVEAL}>
            <SectionHeader
              title="Top 10 Cryptocurrencies"
              subtitle="Live market feed"
              meta={segmentMeta?.topCryptos}
              generatedAt={generatedAt}
            />
            {renderCryptoGrid()}
          </motion.section>
        ) : null}

        {sectionFilter === "all" ? (
          <motion.section id="section-night" className="surface midnight-surface night-ticker" {...SECTION_REVEAL}>
            {night ? (
              <div className="night-ticker-row">
                <LogoMark name="NIGHT" symbol={night.symbol} logoUrl={night.logoUrl} fallbackLogoUrls={night.fallbackLogoUrls} />
                <span className="night-ticker-name">NIGHT</span>
                <span className="night-ticker-price" title={buildPriceTitle(formatExactCurrency(night.priceUsd), generatedAt)}>{formatCurrency(night.priceUsd)}</span>
                <span className={clsx("night-ticker-change", trendClass(night.change24h))} title="24h change">{formatPercent(night.change24h)}</span>
                <span className="night-ticker-divider" aria-hidden="true" />
                <span className="night-ticker-stat" title={`Exact market cap: ${formatExactNumber(night.marketCapUsd)} USD`}><span>MCap</span> {formatCompactCurrency(night.marketCapUsd)}</span>
                <span className="night-ticker-stat" title={`Exact 24h volume: ${formatExactNumber(night.volume24hUsd)} USD`}><span>Vol</span> {formatCompactCurrency(night.volume24hUsd)}</span>
                <span className="night-ticker-stat" title={`Exact ATH: ${formatExactCurrency(night.athPriceUsd)}`}><span>ATH</span> {formatCurrency(night.athPriceUsd)}</span>
                <span className={clsx("night-ticker-stat", trendClass(night.percentFromAth))} title="Percent from all-time high"><span>From ATH</span> {formatPercent(night.percentFromAth)}</span>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Waiting for NIGHT feed...</p>
            )}
          </motion.section>
        ) : null}

        <footer className="site-footer">
          <div className="footer-glow" aria-hidden="true" />
          <div className="footer-content">
            <div className="footer-brand">
              <span className="footer-logo">World Asset Prices</span>
              <span className="footer-tagline">Real-time global market intelligence</span>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <span className="footer-col-title">Data</span>
                <span>CoinPaprika</span>
                <span>Stooq / Frankfurter</span>
              </div>
              <div className="footer-col">
                <span className="footer-col-title">Built With</span>
                <span>React + TypeScript</span>
                <span>Vite + Tailwind</span>
                <span>Vercel Edge</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} World Asset Prices</span>
            <span className="footer-dot" aria-hidden="true" />
            <span>Not financial advice</span>
          </div>
        </footer>
      </main>
    </>
  );
}

export default App;

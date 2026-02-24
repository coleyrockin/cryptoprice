import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { fetchDashboard } from "./api";
import { MarketCard } from "./components/MarketCard";
import { SectionHeader } from "./components/SectionHeader";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "./lib/formatters";
import type { DashboardAsset, DashboardCrypto, DashboardStock } from "./types/dashboard";

const DEFAULT_REFRESH_SEC = 60;
const WATCHLIST_STORAGE_KEY = "cryptoprice.watchlist.v1";
const EMPTY_CRYPTOS: DashboardCrypto[] = [];
const EMPTY_STOCKS: DashboardStock[] = [];
const EMPTY_ASSETS: DashboardAsset[] = [];

type CategoryFilter = "all" | "crypto" | "stock" | "commodity";
type SortMode = "rank" | "marketCapDesc" | "changeDesc" | "changeAsc" | "nameAsc";

type SortableEntry = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  category: string;
};

function parseWatchlist(raw: string | null): Set<string> {
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function matchesCategory(category: string, filter: CategoryFilter): boolean {
  if (filter === "all") {
    return true;
  }

  return category.toLowerCase() === filter;
}

function matchesSearch(entry: Pick<SortableEntry, "name" | "symbol">, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = `${entry.name} ${entry.symbol}`.toLowerCase();
  return haystack.includes(query);
}

function sortEntries<T extends SortableEntry>(
  entries: T[],
  mode: SortMode,
  watchlistIds: Set<string>,
  getMarketCap: (entry: T) => number | null,
  getChange: (entry: T) => number | null,
): T[] {
  return [...entries].sort((left, right) => {
    const leftPinned = watchlistIds.has(left.id) ? 1 : 0;
    const rightPinned = watchlistIds.has(right.id) ? 1 : 0;
    if (rightPinned !== leftPinned) {
      return rightPinned - leftPinned;
    }

    if (mode === "nameAsc") {
      return left.name.localeCompare(right.name);
    }

    if (mode === "marketCapDesc") {
      const leftCap = getMarketCap(left) ?? Number.NEGATIVE_INFINITY;
      const rightCap = getMarketCap(right) ?? Number.NEGATIVE_INFINITY;
      return rightCap - leftCap;
    }

    if (mode === "changeDesc" || mode === "changeAsc") {
      const leftChange = getChange(left) ?? Number.NEGATIVE_INFINITY;
      const rightChange = getChange(right) ?? Number.NEGATIVE_INFINITY;
      return mode === "changeDesc" ? rightChange - leftChange : leftChange - rightChange;
    }

    return left.rank - right.rank;
  });
}

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
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const [secondsToRefresh, setSecondsToRefresh] = useState(DEFAULT_REFRESH_SEC);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set<string>());
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const refreshInSec = query.state.data?.refreshInSec ?? DEFAULT_REFRESH_SEC;
      return refreshInSec * 1_000;
    },
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    setWatchlistIds(parseWatchlist(stored));
  }, []);

  useEffect(() => {
    const asList = Array.from(watchlistIds).sort();
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(asList));
  }, [watchlistIds]);

  const dashboard = dashboardQuery.data;
  const topCryptos = dashboard?.topCryptos ?? EMPTY_CRYPTOS;
  const topStocks = dashboard?.topStocks ?? EMPTY_STOCKS;
  const topAssets = dashboard?.topAssets ?? EMPTY_ASSETS;
  const night = dashboard?.night ?? null;
  const refreshInSec = dashboard?.refreshInSec ?? DEFAULT_REFRESH_SEC;

  const searchKey = searchQuery.trim().toLowerCase();

  const filteredCryptos = useMemo(() => {
    const visible = topCryptos.filter((entry) => {
      if (!matchesCategory(entry.category, categoryFilter)) {
        return false;
      }

      if (!matchesSearch(entry, searchKey)) {
        return false;
      }

      if (watchlistOnly && !watchlistIds.has(entry.id)) {
        return false;
      }

      return true;
    });

    return sortEntries(
      visible,
      sortMode,
      watchlistIds,
      (entry) => entry.marketCapUsd,
      (entry) => entry.change24h,
    );
  }, [topCryptos, categoryFilter, searchKey, watchlistOnly, watchlistIds, sortMode]);

  const filteredStocks = useMemo(() => {
    const visible = topStocks.filter((entry) => {
      if (!matchesCategory(entry.category, categoryFilter)) {
        return false;
      }

      if (!matchesSearch(entry, searchKey)) {
        return false;
      }

      if (watchlistOnly && !watchlistIds.has(entry.id)) {
        return false;
      }

      return true;
    });

    return sortEntries(
      visible,
      sortMode,
      watchlistIds,
      (entry) => entry.marketCapUsd,
      (entry) => entry.changePercent,
    );
  }, [topStocks, categoryFilter, searchKey, watchlistOnly, watchlistIds, sortMode]);

  const filteredAssets = useMemo(() => {
    const visible = topAssets.filter((entry) => {
      if (!matchesCategory(entry.category, categoryFilter)) {
        return false;
      }

      if (!matchesSearch(entry, searchKey)) {
        return false;
      }

      if (watchlistOnly && !watchlistIds.has(entry.id)) {
        return false;
      }

      return true;
    });

    return sortEntries(
      visible,
      sortMode,
      watchlistIds,
      (entry) => entry.marketCapUsd,
      () => null,
    );
  }, [topAssets, categoryFilter, searchKey, watchlistOnly, watchlistIds, sortMode]);

  const compareCandidates = useMemo(() => {
    const byId = new Map(topCryptos.map((entry) => [entry.id, entry]));
    return compareIds.map((id) => byId.get(id)).filter((entry): entry is DashboardCrypto => Boolean(entry));
  }, [compareIds, topCryptos]);

  useEffect(() => {
    if (filteredCryptos.length === 0) {
      setActiveCryptoIndex(0);
      return;
    }

    if (activeCryptoIndex > filteredCryptos.length - 1) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, filteredCryptos.length]);

  useEffect(() => {
    const cryptoIds = new Set(topCryptos.map((entry) => entry.id));
    setCompareIds((current) => {
      const next = current.filter((id) => cryptoIds.has(id)).slice(0, 3);
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }

      return next;
    });
  }, [topCryptos]);

  useEffect(() => {
    if (!dashboard) {
      setSecondsToRefresh(refreshInSec);
      return;
    }

    const generatedAtMs = Date.parse(dashboard.generatedAt);
    const originMs = Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();
    const targetMs = originMs + refreshInSec * 1_000;

    const tick = () => {
      const remainingMs = targetMs - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1_000));
      setSecondsToRefresh(remainingSec);
    };

    tick();
    const timer = window.setInterval(tick, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [dashboard, refreshInSec]);

  const togglePin = (id: string) => {
    setWatchlistIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }

      if (current.length >= 3) {
        return [...current.slice(1), id];
      }

      return [...current, id];
    });
  };

  const isBooting = dashboardQuery.isPending && !dashboard;
  const hasError = dashboardQuery.isError && !dashboard;
  const isStale = Boolean(dashboard?.stale);
  const degradedSegments = dashboard?.degradedSegments ?? [];

  const statusTone = hasError ? "status error" : isBooting ? "status loading" : isStale ? "status stale" : "status live";

  const degradedDetail =
    degradedSegments.length > 0 ? ` (${degradedSegments.map((segment) => segment.replace("top", "")).join(", ").toLowerCase()})` : "";

  const statusPrefix = hasError
    ? "Feed unavailable - retrying"
    : isBooting
      ? "Connecting market feeds"
      : isStale
        ? `Stale cache in use${degradedDetail}`
        : "Live market data";

  const statusAriaLabel = `${statusPrefix}. Dashboard refreshes every ${refreshInSec} seconds.`;

  const renderCryptoGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!filteredCryptos.length) {
      return <p className="muted">No cryptos match your filters.</p>;
    }

    return (
      <div className="coin-grid">
        {filteredCryptos.map((coin, index) => (
          <MarketCard
            key={coin.id}
            id={coin.id}
            rank={coin.rank}
            name={coin.name}
            symbol={coin.symbol}
            meta={coin.category}
            value={formatCurrency(coin.priceUsd)}
            secondary={formatPercent(coin.change24h)}
            secondaryClassName={clsx("coin-change", trendClass(coin.change24h))}
            index={index}
            logoUrl={coin.logoUrl}
            fallbackLogoUrls={coin.fallbackLogoUrls}
            interactive
            active={index === activeCryptoIndex}
            onClick={() => setActiveCryptoIndex(index)}
            pinned={watchlistIds.has(coin.id)}
            onTogglePin={() => togglePin(coin.id)}
            compared={compareIds.includes(coin.id)}
            onToggleCompare={() => toggleCompare(coin.id)}
            sparkline={coin.sparkline7d}
          />
        ))}
      </div>
    );
  };

  const renderStockGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!filteredStocks.length) {
      return <p className="muted">No stocks match your filters.</p>;
    }

    return (
      <div className="coin-grid">
        {filteredStocks.map((stock, index) => {
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
              value={formatCompactCurrency(stock.marketCapUsd)}
              secondary={hasChange ? changeText : "Market cap ranking"}
              secondaryClassName={hasChange ? clsx("coin-change", trendClass(stock.changePercent)) : "asset-note"}
              index={index}
              logoUrl={stock.logoUrl}
              fallbackLogoUrls={stock.fallbackLogoUrls}
              assetStyle
              pinned={watchlistIds.has(stock.id)}
              onTogglePin={() => togglePin(stock.id)}
            />
          );
        })}
      </div>
    );
  };

  const renderAssetGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!filteredAssets.length) {
      return <p className="muted">No assets match your filters.</p>;
    }

    return (
      <div className="coin-grid">
        {filteredAssets.map((asset, index) => (
          <MarketCard
            key={asset.id}
            id={asset.id}
            rank={asset.rank}
            name={asset.name}
            symbol={asset.symbol}
            meta={asset.category}
            value={formatCompactCurrency(asset.marketCapUsd)}
            secondary="Estimated market cap"
            secondaryClassName="asset-note"
            index={index}
            logoUrl={asset.logoUrl}
            fallbackLogoUrls={asset.fallbackLogoUrls}
            assetStyle
            pinned={watchlistIds.has(asset.id)}
            onTogglePin={() => togglePin(asset.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Cryptoprice</p>
        <h1>
          Crypto & Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">Top 10 cryptos, top 10 stocks, top 10 global assets, and NIGHT price.</p>

        <div className={statusTone} role="status" aria-live="polite" aria-atomic="true" aria-label={statusAriaLabel}>
          <span>{statusPrefix}</span>
          <span className="status-refresh" aria-hidden="true">
            {` - refresh in ${secondsToRefresh}s`}
          </span>
        </div>
      </header>

      <nav className="section-nav" aria-label="Dashboard sections">
        <a href="#section-cryptos">Cryptos</a>
        <a href="#section-compare">Compare</a>
        <a href="#section-stocks">Stocks</a>
        <a href="#section-assets">Assets</a>
        <a href="#section-night">NIGHT</a>
      </nav>

      <section className="surface controls-surface" aria-label="Dashboard controls">
        <SectionHeader title="Controls" subtitle="Search, filter, sort, and watchlist tools" />
        <div className="controls-grid">
          <label className="control">
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search symbol or name"
            />
          </label>

          <label className="control">
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}>
              <option value="all">All</option>
              <option value="crypto">Crypto</option>
              <option value="stock">Stock</option>
              <option value="commodity">Commodity</option>
            </select>
          </label>

          <label className="control">
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="rank">Rank</option>
              <option value="marketCapDesc">Market Cap (desc)</option>
              <option value="changeDesc">Change (highest)</option>
              <option value="changeAsc">Change (lowest)</option>
              <option value="nameAsc">Name (A-Z)</option>
            </select>
          </label>

          <label className="control control-checkbox">
            <input
              type="checkbox"
              checked={watchlistOnly}
              onChange={(event) => setWatchlistOnly(event.target.checked)}
            />
            <span>Show watchlist only ({watchlistIds.size})</span>
          </label>
        </div>

        <div className="controls-actions">
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
              setSortMode("rank");
              setWatchlistOnly(false);
            }}
          >
            Reset Filters
          </button>
          <button type="button" onClick={() => setWatchlistIds(new Set())} disabled={watchlistIds.size === 0}>
            Clear Watchlist
          </button>
        </div>
      </section>

      <section id="section-cryptos" className="surface">
        <SectionHeader title="Top 10 Cryptos" subtitle="Live market feed" />
        {renderCryptoGrid()}
      </section>

      <section id="section-compare" className="surface compare-surface">
        <SectionHeader title="Compare" subtitle="Select up to three cryptos using the Compare button on cards" />

        {compareCandidates.length ? (
          <div className="compare-grid">
            {compareCandidates.map((coin) => (
              <article className="compare-card" key={`compare-${coin.id}`}>
                <header>
                  <h3>{coin.name}</h3>
                  <span className="symbol-pill">{coin.symbol}</span>
                </header>
                <p>{formatCurrency(coin.priceUsd)}</p>
                <p className={clsx("coin-change", trendClass(coin.change24h))}>{formatPercent(coin.change24h)} (24h)</p>
                <p className="asset-note">MCap {formatCompactCurrency(coin.marketCapUsd)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No compare selection yet. Use Compare on crypto cards to add up to 3 entries.</p>
        )}
      </section>

      <section id="section-stocks" className="surface global-assets-surface">
        <SectionHeader title="Top 10 Stocks" subtitle="By estimated market cap" />
        {renderStockGrid()}
      </section>

      <section id="section-assets" className="surface global-assets-surface">
        <SectionHeader title="Top 10 Assets" subtitle="By estimated market cap" />
        {renderAssetGrid()}
        <p className="disclaimer">* Approximate values. Network/API conditions may delay updates.</p>
      </section>

      <section id="section-night" className="surface midnight-surface">
        <SectionHeader
          title="NIGHT Price"
          subtitle="Live Midnight token telemetry"
          accentSymbol={night?.symbol ?? "NIGHT"}
          accentLogoUrl={night?.logoUrl}
          accentFallbackLogoUrls={night?.fallbackLogoUrls}
        />

        {night ? (
          <div className="midnight-layout">
            <div className="night-main">
              <p className="eyebrow">Spot Price</p>
              <h3 className="night-price">{formatCurrency(night.priceUsd)}</h3>
              <p className={clsx("night-change", trendClass(night.change24h))}>{formatPercent(night.change24h)} (24h)</p>

              <div className="night-stats">
                <article>
                  <p>Market Cap</p>
                  <strong>{formatCompactCurrency(night.marketCapUsd)}</strong>
                </article>
                <article>
                  <p>Volume (24h)</p>
                  <strong>{formatCompactCurrency(night.volume24hUsd)}</strong>
                </article>
                <article>
                  <p>All-Time High</p>
                  <strong>{formatCurrency(night.athPriceUsd)}</strong>
                </article>
                <article>
                  <p>From ATH</p>
                  <strong className={trendClass(night.percentFromAth)}>{formatPercent(night.percentFromAth)}</strong>
                </article>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Waiting for NIGHT feed...</p>
        )}
      </section>
    </main>
  );
}

export default App;

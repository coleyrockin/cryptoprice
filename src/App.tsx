import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";

import { fetchDashboard } from "./api";
import { MarketCard } from "./components/MarketCard";
import { SectionHeader } from "./components/SectionHeader";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "./lib/formatters";

const DEFAULT_REFRESH_SEC = 60;

function App() {
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const [secondsToRefresh, setSecondsToRefresh] = useState(DEFAULT_REFRESH_SEC);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const refreshInSec = query.state.data?.refreshInSec ?? DEFAULT_REFRESH_SEC;
      return refreshInSec * 1_000;
    },
  });

  const dashboard = dashboardQuery.data;
  const topCryptos = dashboard?.topCryptos ?? [];
  const topStocks = dashboard?.topStocks ?? [];
  const topAssets = dashboard?.topAssets ?? [];
  const night = dashboard?.night ?? null;
  const refreshInSec = dashboard?.refreshInSec ?? DEFAULT_REFRESH_SEC;

  useEffect(() => {
    if (topCryptos.length === 0) {
      return;
    }

    if (activeCryptoIndex > topCryptos.length - 1) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, topCryptos.length]);

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

  const isBooting = dashboardQuery.isPending && !dashboard;
  const hasError = dashboardQuery.isError && !dashboard;
  const isStale = Boolean(dashboard?.stale);

  const statusTone = hasError ? "status error" : isBooting ? "status loading" : isStale ? "status stale" : "status live";

  const statusPrefix = hasError
    ? "Feed unavailable - retrying"
    : isBooting
      ? "Connecting market feeds"
      : isStale
        ? "Stale cache in use"
        : "Live market data";

  const statusAriaLabel = `${statusPrefix}. Dashboard refreshes every ${refreshInSec} seconds.`;

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

      <section className="surface">
        <SectionHeader title="Top 10 Cryptos" subtitle="Live market feed" />

        <div className="coin-grid">
          {topCryptos.map((coin, index) => (
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
            />
          ))}

          {!topCryptos.length ? <p className="muted">Crypto feed is temporarily unavailable.</p> : null}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <SectionHeader title="Top 10 Stocks" subtitle="By estimated market cap" />

        <div className="coin-grid">
          {topStocks.map((stock, index) => {
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
              />
            );
          })}

          {!topStocks.length ? <p className="muted">Stock feed is temporarily unavailable.</p> : null}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <SectionHeader title="Top 10 Assets" subtitle="By estimated market cap" />

        <div className="coin-grid">
          {topAssets.map((asset, index) => (
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
            />
          ))}

          {!topAssets.length ? <p className="muted">Asset feed is temporarily unavailable.</p> : null}
        </div>

        <p className="disclaimer">* Approximate values. Network/API conditions may delay updates.</p>
      </section>

      <section className="surface midnight-surface">
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

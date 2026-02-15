import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import { fetchNight, fetchTopTen, getGlobalAssets, getTopStocks } from "./api";

const REFRESH_MS = 60_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCurrency(value: number): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const abs = Math.abs(value);

  let maxDigits = 2;
  if (abs < 1) {
    maxDigits = abs < 0.01 ? 8 : 6;
  } else if (abs < 100) {
    maxDigits = 4;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxDigits,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function trendClass(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "is-flat";
  }

  return value > 0 ? "is-up" : "is-down";
}

function App() {
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  const topTenQuery = useQuery({
    queryKey: ["top-ten"],
    queryFn: fetchTopTen,
    refetchInterval: REFRESH_MS,
  });

  const nightQuery = useQuery({
    queryKey: ["night"],
    queryFn: fetchNight,
    refetchInterval: REFRESH_MS,
  });

  const topTen = topTenQuery.data ?? [];
  const night = nightQuery.data ?? null;
  const topStocks = useMemo(() => getTopStocks(), []);
  const topAssets = useMemo(() => getGlobalAssets(), []);

  useEffect(() => {
    if (topTen.length === 0) {
      return;
    }

    if (activeCryptoIndex > topTen.length - 1) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, topTen.length]);

  useEffect(() => {
    setSecondsToRefresh(60);

    const timer = window.setInterval(() => {
      setSecondsToRefresh((current) => (current <= 1 ? 60 : current - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [topTenQuery.dataUpdatedAt, nightQuery.dataUpdatedAt]);

  const isBooting = topTenQuery.isPending || nightQuery.isPending;
  const hasError = topTenQuery.isError || nightQuery.isError;

  const statusTone = isBooting ? "status loading" : hasError ? "status error" : "status live";
  const statusText = isBooting
    ? "Connecting market feeds..."
    : hasError
      ? "Partial feed outage - auto retrying"
      : `Live now - refresh in ${secondsToRefresh}s`;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Cryptoprice</p>
        <h1>
          Crypto & Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">Top 10 cryptos, top 10 stocks, top 10 global assets, and NIGHT price.</p>
        <div className={statusTone}>{statusText}</div>
      </header>

      <section className="surface">
        <div className="surface-head">
          <h2>Top 10 Cryptos</h2>
          <p>Live market feed</p>
        </div>

        <div className="coin-grid">
          {topTen.map((coin, index) => {
            const usd = coin.quotes.USD;

            return (
              <motion.button
                key={coin.id}
                className={clsx("coin-card", index === activeCryptoIndex && "active")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.22 }}
                onClick={() => setActiveCryptoIndex(index)}
                type="button"
              >
                <div className="coin-head">
                  <span>#{coin.rank}</span>
                  <span>{coin.symbol}</span>
                </div>
                <h3>{coin.name}</h3>
                <p className="coin-price">{formatCurrency(usd.price)}</p>
                <p className={clsx("coin-change", trendClass(usd.percent_change_24h))}>
                  {formatPercent(usd.percent_change_24h)}
                </p>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <div className="surface-head">
          <h2>Top 10 Stocks</h2>
          <p>By estimated market cap</p>
        </div>

        <div className="coin-grid">
          {topStocks.map((stock) => (
            <div key={stock.symbol} className="coin-card asset-card">
              <div className="coin-head">
                <span>#{stock.rank}</span>
                <span className="asset-category">Stock</span>
              </div>
              <h3>{stock.name}</h3>
              <p className="coin-price">{stock.symbol}</p>
              <p className="asset-mcap">{formatCompactCurrency(stock.marketCap)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <div className="surface-head">
          <h2>Top 10 Assets</h2>
          <p>By estimated market cap</p>
        </div>

        <div className="coin-grid">
          {topAssets.map((asset) => (
            <div key={asset.symbol} className="coin-card asset-card">
              <div className="coin-head">
                <span>#{asset.rank}</span>
                <span className="asset-category">{asset.category}</span>
              </div>
              <h3>{asset.name}</h3>
              <p className="coin-price">{asset.symbol}</p>
              <p className="asset-mcap">{formatCompactCurrency(asset.marketCap)}</p>
            </div>
          ))}
        </div>
        <p className="disclaimer">* Approximate values — may not reflect real-time prices.</p>
      </section>

      <section className="surface midnight-surface">
        <div className="surface-head">
          <h2>NIGHT Price</h2>
          <p>Live Midnight token telemetry</p>
        </div>

        {night ? (
          <div className="midnight-layout">
            <div className="night-main">
              <p className="eyebrow">Spot Price</p>
              <h3 className="night-price">{formatCurrency(night.quotes.USD.price)}</h3>
              <p className={clsx("night-change", trendClass(night.quotes.USD.percent_change_24h))}>
                {formatPercent(night.quotes.USD.percent_change_24h)} (24h)
              </p>

              <div className="night-stats">
                <article>
                  <p>Market Cap</p>
                  <strong>{formatCompactCurrency(night.quotes.USD.market_cap)}</strong>
                </article>
                <article>
                  <p>Volume (24h)</p>
                  <strong>{formatCompactCurrency(night.quotes.USD.volume_24h)}</strong>
                </article>
                <article>
                  <p>All-Time High</p>
                  <strong>{formatCurrency(night.quotes.USD.ath_price)}</strong>
                </article>
                <article>
                  <p>From ATH</p>
                  <strong className={trendClass(night.quotes.USD.percent_from_price_ath)}>
                    {formatPercent(night.quotes.USD.percent_from_price_ath)}
                  </strong>
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

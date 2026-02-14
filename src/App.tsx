import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchNight, fetchNightRange, fetchTopTen, getGlobalAssets } from "./api";
import type { Ticker } from "./api";

const REFRESH_MS = 60_000;
const SPOTLIGHT_MS = 5_500;

function formatCurrency(value: number): string {
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPercentFromUnknown(value: number | string | readonly (number | string)[] | undefined): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  const numeric = typeof normalized === "number" ? normalized : Number(normalized);

  if (!Number.isFinite(numeric)) {
    return "n/a";
  }

  return formatPercent(numeric);
}

function trendClass(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "is-flat";
  }

  return value > 0 ? "is-up" : "is-down";
}

function freshAge(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const deltaMs = Date.now() - date.getTime();
  const deltaMinutes = Math.max(0, Math.floor(deltaMs / 60_000));

  if (deltaMinutes < 1) {
    return "just now";
  }

  return `${deltaMinutes}m ago`;
}

function Spotlight({ coin }: { coin: Ticker | null }) {
  if (!coin) {
    return (
      <div className="spotlight-empty">
        <p>Waiting for market feed...</p>
      </div>
    );
  }

  const usd = coin.quotes.USD;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={coin.id}
        className="spotlight-body"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <div className="spot-badge" />

        <div>
          <p className="muted">Live Focus</p>
          <h3>
            {coin.name} <span>{coin.symbol}</span>
          </h3>
          <p className="spot-price">{formatCurrency(usd.price)}</p>
          <p className={clsx("spot-change", trendClass(usd.percent_change_24h))}>
            {formatPercent(usd.percent_change_24h)} (24h)
          </p>
        </div>

        <div className="spot-stats">
          <article>
            <p>Market Cap</p>
            <strong>{formatCompactCurrency(usd.market_cap)}</strong>
          </article>
          <article>
            <p>Volume (24h)</p>
            <strong>{formatCompactCurrency(usd.volume_24h)}</strong>
          </article>
          <article>
            <p>Rank</p>
            <strong>#{coin.rank}</strong>
          </article>
          <article>
            <p>Update</p>
            <strong>{freshAge(coin.last_updated)}</strong>
          </article>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [activeIndex, setActiveIndex] = useState(0);
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

  const nightRangeQuery = useQuery({
    queryKey: ["night-range"],
    queryFn: fetchNightRange,
    refetchInterval: REFRESH_MS,
  });

  const topTen = topTenQuery.data ?? [];
  const night = nightQuery.data ?? null;
  const nightRange = nightRangeQuery.data ?? null;

  useEffect(() => {
    if (topTen.length === 0) {
      return;
    }

    if (activeIndex > topTen.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, topTen.length]);

  useEffect(() => {
    if (topTen.length < 2) {
      return;
    }

    const cycle = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % topTen.length);
    }, SPOTLIGHT_MS);

    return () => window.clearInterval(cycle);
  }, [topTen.length]);

  useEffect(() => {
    setSecondsToRefresh(60);

    const timer = window.setInterval(() => {
      setSecondsToRefresh((current) => (current <= 1 ? 60 : current - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [topTenQuery.dataUpdatedAt, nightQuery.dataUpdatedAt, nightRangeQuery.dataUpdatedAt]);

  const activeCoin = topTen[activeIndex] ?? null;
  const globalAssets = useMemo(() => getGlobalAssets(), []);

  const isBooting = topTenQuery.isPending || nightQuery.isPending;
  const hasError = topTenQuery.isError || nightQuery.isError;

  const statusTone = isBooting ? "status loading" : hasError ? "status error" : "status live";
  const statusText = isBooting
    ? "Connecting market feeds..."
    : hasError
      ? "Partial feed outage - auto retrying"
      : `Live now - refresh in ${secondsToRefresh}s`;

  const marketChangeChart = useMemo(
    () =>
      topTen.map((coin) => ({
        symbol: coin.symbol,
        change: coin.quotes.USD.percent_change_24h,
      })),
    [topTen],
  );

  const nightMomentum = useMemo(() => {
    if (!night) {
      return [];
    }

    const usd = night.quotes.USD;

    return [
      ["15m", usd.percent_change_15m],
      ["1h", usd.percent_change_1h],
      ["6h", usd.percent_change_6h],
      ["24h", usd.percent_change_24h],
      ["7d", usd.percent_change_7d],
    ] as const;
  }, [night]);

  const rangePercentage = useMemo(() => {
    if (!nightRange) {
      return null;
    }

    const spread = nightRange.high - nightRange.low;
    if (!Number.isFinite(spread) || spread <= 0) {
      return null;
    }

    const raw = ((nightRange.close - nightRange.low) / spread) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [nightRange]);

  const rangeStyle = {
    "--range-value": `${rangePercentage ?? 0}%`,
  } as CSSProperties;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Cryptoprice</p>
        <h1>
          Crypto & Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">
          Live top 10 crypto rankings, top global assets by market cap, and a deep dive into Midnight — the data protection blockchain powered by zero-knowledge proofs.
        </p>
        <div className={statusTone}>{statusText}</div>
      </header>

      <section className="surface">
        <div className="surface-head">
          <h2>Top 10 Command Grid</h2>
          <p>Tap any coin to force spotlight</p>
        </div>

        <div className="coin-grid">
          {topTen.map((coin, index) => {
            const usd = coin.quotes.USD;
            const cardStyle = {
              "--card-index": index,
            } as CSSProperties;

            return (
              <motion.button
                key={coin.id}
                style={cardStyle}
                className={clsx("coin-card", index === activeIndex && "active")}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.035, duration: 0.28 }}
                onClick={() => setActiveIndex(index)}
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

      <section className="surface spotlight-surface">
        <div className="surface-head">
          <h2>Spotlight Reactor</h2>
          <p>Auto cycling every 5.5s</p>
        </div>

        <Spotlight coin={activeCoin} />
      </section>

      <section className="surface chart-surface">
        <div className="surface-head">
          <h2>24h Volatility Skyline</h2>
          <p>Positive and negative pressure map</p>
        </div>

        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marketChangeChart} margin={{ top: 10, right: 16, left: -22, bottom: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fill: "#8f8f96", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value) => `${value}%`}
                tick={{ fill: "#8f8f96", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                contentStyle={{
                  background: "#060608",
                  borderColor: "rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  color: "#f3f3f4",
                }}
                formatter={(value) => formatPercentFromUnknown(value)}
              />
              <Bar dataKey="change" radius={[6, 6, 6, 6]}>
                {marketChangeChart.map((entry) => (
                  <Cell key={entry.symbol} fill={entry.change >= 0 ? "#95ffd0" : "#ff8f86"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="surface midnight-surface">
        <div className="surface-head">
          <h2>Midnight Token - NIGHT</h2>
          <p>Dedicated telemetry channel</p>
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

              <div className="momentum-row">
                {nightMomentum.map(([label, value]) => (
                  <div key={label} className="momentum-pill">
                    <span>{label}</span>
                    <strong className={trendClass(value)}>{formatPercent(value)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="night-side">
              <div className="range-gauge" style={rangeStyle}>
                <div className="range-gauge-core">
                  <strong>{rangePercentage ? `${rangePercentage.toFixed(1)}%` : "--"}</strong>
                  <span>close in range</span>
                </div>
              </div>

              <div className="ohlc-grid">
                <article>
                  <p>Low</p>
                  <strong>{nightRange ? formatCurrency(nightRange.low) : "--"}</strong>
                </article>
                <article>
                  <p>Open</p>
                  <strong>{nightRange ? formatCurrency(nightRange.open) : "--"}</strong>
                </article>
                <article>
                  <p>Close</p>
                  <strong>{nightRange ? formatCurrency(nightRange.close) : "--"}</strong>
                </article>
                <article>
                  <p>High</p>
                  <strong>{nightRange ? formatCurrency(nightRange.high) : "--"}</strong>
                </article>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Waiting for NIGHT feed...</p>
        )}
      </section>

      <section className="surface global-assets-surface">
        <div className="surface-head">
          <h2>Top 10 Global Assets</h2>
          <p>By estimated market cap</p>
        </div>

        <div className="coin-grid">
          {globalAssets.map((asset, index) => {
            const cardStyle = { "--card-index": index } as CSSProperties;
            return (
              <div key={asset.symbol} style={cardStyle} className="coin-card asset-card">
                <div className="coin-head">
                  <span>#{asset.rank}</span>
                  <span className="asset-category">{asset.category}</span>
                </div>
                <h3>{asset.name}</h3>
                <p className="coin-price">{asset.symbol}</p>
                <p className="asset-mcap">{formatCompactCurrency(asset.marketCap)}</p>
              </div>
            );
          })}
        </div>
        <p className="disclaimer">* Approximate values — may not reflect real-time prices.</p>
      </section>

      <section className="surface education-surface">
        <div className="surface-head">
          <h2>What is Midnight?</h2>
          <p>Data protection blockchain</p>
        </div>

        <div className="education-layout">
          <div className="edu-intro">
            <p>
              Midnight is a data protection blockchain that safeguards sensitive commercial and personal data.
              It uses zero-knowledge cryptography to enable trustless data protection, built as a partner chain
              within the Cardano ecosystem.
            </p>
          </div>

          <div className="edu-grid">
            <article className="edu-card">
              <h3>🔐 Zero-Knowledge Proofs</h3>
              <p>Advanced ZK proof technology ensures data privacy without revealing underlying information.</p>
            </article>
            <article className="edu-card">
              <h3>📜 Smart Contracts</h3>
              <p>Smart contracts that protect sensitive data while maintaining on-chain verifiability.</p>
            </article>
            <article className="edu-card">
              <h3>🔗 Cardano Partner Chain</h3>
              <p>Built on Cardano's partner chain framework, leveraging its proven security and decentralization.</p>
            </article>
            <article className="edu-card">
              <h3>🪙 Dual-Token Model</h3>
              <p>NIGHT serves as the utility token and DUST as the operational token for network transactions.</p>
            </article>
          </div>

          <div className="edu-usecases">
            <h3>Use Cases</h3>
            <div className="usecase-pills">
              <span className="usecase-pill">Regulatory Compliance</span>
              <span className="usecase-pill">Enterprise Data Protection</span>
              <span className="usecase-pill">Private DeFi</span>
              <span className="usecase-pill">Identity Solutions</span>
            </div>
          </div>
        </div>
      </section>

      <section className="surface exchange-surface">
        <div className="surface-head">
          <h2>Where to Buy NIGHT</h2>
          <p>Available on these exchanges</p>
        </div>

        <div className="exchange-grid">
          <a href="https://www.mexc.com/" target="_blank" rel="noopener noreferrer" className="exchange-card">
            <h3>MEXC</h3>
            <p>Global crypto exchange</p>
          </a>
          <a href="https://www.gate.io/" target="_blank" rel="noopener noreferrer" className="exchange-card">
            <h3>Gate.io</h3>
            <p>Trusted trading platform</p>
          </a>
          <a href="https://www.bitget.com/" target="_blank" rel="noopener noreferrer" className="exchange-card">
            <h3>Bitget</h3>
            <p>Copy-trading exchange</p>
          </a>
        </div>
        <p className="disclaimer">Always do your own research (DYOR) before investing.</p>
      </section>

      <section className="surface involved-surface">
        <div className="surface-head">
          <h2>Get Involved</h2>
          <p>Join the Midnight community</p>
        </div>

        <div className="involved-grid">
          <a href="https://midnight.network" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>🌐 Official Website</h3>
            <p>midnight.network</p>
          </a>
          <a href="https://docs.midnight.network" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>📚 Documentation</h3>
            <p>docs.midnight.network</p>
          </a>
          <a href="https://discord.gg/midnight" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>💬 Discord</h3>
            <p>Midnight community</p>
          </a>
          <a href="https://x.com/MidnightNtwrk" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>🐦 Twitter / X</h3>
            <p>@MidnightNtwrk</p>
          </a>
          <a href="https://github.com/midnight-network" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>🐙 GitHub</h3>
            <p>Open source contributions</p>
          </a>
          <a href="https://github.com/coleyrockin/cryptoprice" target="_blank" rel="noopener noreferrer" className="involved-card">
            <h3>📊 Cryptoprice</h3>
            <p>This project on GitHub</p>
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  accentSymbol?: string;
  accentLogoUrl?: string;
  accentFallbackLogoUrls?: string[];
};

function SectionHeader({ title, subtitle, accentSymbol, accentLogoUrl, accentFallbackLogoUrls }: SectionHeaderProps) {
  return (
    <div className="surface-head">
      <div className="surface-title-row">
        <h2>{title}</h2>
        {accentSymbol || accentLogoUrl || accentFallbackLogoUrls?.length ? (
          <div className="surface-title-accent">
            <LogoMark
              name={`${title} accent`}
              symbol={accentSymbol ?? title}
              logoUrl={accentLogoUrl}
              fallbackLogoUrls={accentFallbackLogoUrls}
            />
            {accentSymbol ? <span className="symbol-pill surface-symbol">{accentSymbol}</span> : null}
          </div>
        ) : null}
      </div>
      <p>{subtitle}</p>
    </div>
  );
}

type MarketCardProps = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  meta: string;
  value: string;
  secondary?: string;
  secondaryClassName?: string;
  index: number;
  logoUrl?: string;
  fallbackLogoUrls?: string[];
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
};

type LogoMarkProps = {
  name: string;
  symbol: string;
  logoUrl?: string;
  fallbackLogoUrls?: string[];
};

function normalizeMonogram(symbol: string): string {
  const cleaned = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return cleaned || symbol.slice(0, 2).toUpperCase();
}

function LogoMark({ name, symbol, logoUrl, fallbackLogoUrls = [] }: LogoMarkProps) {
  const [logoIndex, setLogoIndex] = useState(0);
  const sources = [logoUrl, ...fallbackLogoUrls].filter(Boolean) as string[];
  const current = sources[logoIndex];
  const sourceKey = sources.join("|");

  useEffect(() => {
    setLogoIndex(0);
  }, [sourceKey, symbol]);

  if (!current) {
    return (
      <span className="logo-fallback" aria-hidden="true">
        {normalizeMonogram(symbol)}
      </span>
    );
  }

  return (
    <img
      src={current}
      alt={`${name} logo`}
      className="asset-logo"
      loading="lazy"
      onError={() => {
        setLogoIndex((previous) => previous + 1);
      }}
    />
  );
}

function MarketCard({
  id,
  rank,
  name,
  symbol,
  meta,
  value,
  secondary,
  secondaryClassName,
  index,
  logoUrl,
  fallbackLogoUrls,
  interactive = false,
  active = false,
  onClick,
}: MarketCardProps) {
  const cardStyle = {
    "--card-index": index,
  } as CSSProperties;

  const content: ReactNode = (
    <>
      <div className="coin-head">
        <span>#{rank}</span>
        <span className="asset-category">{meta}</span>
      </div>
      <div className="coin-title-row">
        <div className="coin-title-main">
          <LogoMark name={name} symbol={symbol} logoUrl={logoUrl} fallbackLogoUrls={fallbackLogoUrls} />
          <h3>{name}</h3>
        </div>
        <span className="symbol-pill">{symbol}</span>
      </div>
      <p className="coin-price">{value}</p>
      {secondary ? <p className={secondaryClassName}>{secondary}</p> : null}
    </>
  );

  if (!interactive) {
    return (
      <div key={id} className="coin-card asset-card" style={cardStyle}>
        {content}
      </div>
    );
  }

  return (
    <motion.button
      key={id}
      style={cardStyle}
      className={clsx("coin-card", active && "active")}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.22 }}
      onClick={onClick}
      type="button"
      aria-pressed={active}
    >
      {content}
    </motion.button>
  );
}

function App() {
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);
  const [scrollProgress, setScrollProgress] = useState(0);

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
  const topStocks = getTopStocks();
  const topAssets = getGlobalAssets();

  useEffect(() => {
    if (topTen.length === 0) {
      return;
    }

    if (activeCryptoIndex > topTen.length - 1) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, topTen.length]);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        const maxScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const next = Math.min(1, Math.max(0, window.scrollY / maxScrollable));
        setScrollProgress((previous) => (Math.abs(previous - next) > 0.002 ? next : previous));
      });
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

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

  const shellStyle = {
    "--scroll-progress": scrollProgress.toFixed(4),
  } as CSSProperties;

  return (
    <main className="shell" style={shellStyle}>
      <header className="hero">
        <p className="eyebrow">Cryptoprice</p>
        <h1>
          Crypto & Global Assets <span>Dashboard</span>
        </h1>
        <p className="tagline">Top 10 cryptos, top 10 stocks, top 10 global assets, and NIGHT price.</p>
        <div className={statusTone}>{statusText}</div>
      </header>

      <section className="surface">
        <SectionHeader title="Top 10 Cryptos" subtitle="Live market feed" />

        <div className="coin-grid">
          {topTen.map((coin, index) => {
            const usd = coin.quotes.USD;

            return (
              <MarketCard
                key={coin.id}
                id={coin.id}
                rank={coin.rank}
                name={coin.name}
                symbol={coin.symbol}
                meta="Crypto"
                value={formatCurrency(usd.price)}
                secondary={formatPercent(usd.percent_change_24h)}
                secondaryClassName={clsx("coin-change", trendClass(usd.percent_change_24h))}
                index={index}
                logoUrl={`https://static.coinpaprika.com/coin/${coin.id}/logo.png`}
                fallbackLogoUrls={[
                  `https://cryptoicons.org/api/icon/${coin.symbol.toLowerCase()}/200`,
                  `https://cryptoicon-api.pages.dev/api/icon/${coin.symbol.toLowerCase()}`,
                ]}
                interactive
                active={index === activeCryptoIndex}
                onClick={() => setActiveCryptoIndex(index)}
              />
            );
          })}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <SectionHeader title="Top 10 Stocks" subtitle="By estimated market cap" />

        <div className="coin-grid">
          {topStocks.map((stock, index) => {
            return (
              <MarketCard
                key={stock.symbol}
                id={stock.symbol}
                rank={stock.rank}
                name={stock.name}
                symbol={stock.symbol}
                meta="Stock"
                value={formatCompactCurrency(stock.marketCap)}
                secondary="Estimated market cap"
                secondaryClassName="asset-note"
                index={index}
                logoUrl={stock.logoUrl}
                fallbackLogoUrls={stock.fallbackLogoUrls}
              />
            );
          })}
        </div>
      </section>

      <section className="surface global-assets-surface">
        <SectionHeader title="Top 10 Assets" subtitle="By estimated market cap" />

        <div className="coin-grid">
          {topAssets.map((asset, index) => {
            return (
              <MarketCard
                key={`${asset.rank}-${asset.symbol}`}
                id={`${asset.rank}-${asset.symbol}`}
                rank={asset.rank}
                name={asset.name}
                symbol={asset.symbol}
                meta={asset.category}
                value={formatCompactCurrency(asset.marketCap)}
                secondary="Estimated market cap"
                secondaryClassName="asset-note"
                index={index}
                logoUrl={asset.logoUrl}
                fallbackLogoUrls={
                  asset.category === "Crypto"
                    ? [
                        ...(asset.fallbackLogoUrls ?? []),
                        `https://cryptoicons.org/api/icon/${asset.symbol.toLowerCase()}/200`,
                        `https://cryptoicon-api.pages.dev/api/icon/${asset.symbol.toLowerCase()}`,
                      ]
                    : asset.fallbackLogoUrls
                }
              />
            );
          })}
        </div>
        <p className="disclaimer">* Approximate values — may not reflect real-time prices.</p>
      </section>

      <section className="surface midnight-surface">
        <SectionHeader
          title="NIGHT Price"
          subtitle="Live Midnight token telemetry"
          accentSymbol="NIGHT"
          accentLogoUrl="https://static.coinpaprika.com/coin/night-midnight2/logo.png"
          accentFallbackLogoUrls={["https://cryptoicons.org/api/icon/night/200", "https://cryptoicon-api.pages.dev/api/icon/night"]}
        />

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

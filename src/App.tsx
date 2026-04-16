import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDashboard } from "./api";
import { LogoMark } from "./components/LogoMark";
import { MarketCard } from "./components/MarketCard";
import { SectionHeader } from "./components/SectionHeader";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "./lib/formatters";
import { useTheme } from "./hooks/useTheme";
import type { DashboardAsset, DashboardCrypto, DashboardCurrency, DashboardEtf, DashboardStock } from "./types/dashboard";

const SECTION_IDS = ["section-assets", "section-stocks", "section-etfs", "section-currencies", "section-cryptos", "section-night"] as const;

const SECTION_REVEAL = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const DEFAULT_REFRESH_SEC = 30;
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
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("");
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

  useEffect(() => {
    if (topCryptos.length === 0) {
      setActiveCryptoIndex(0);
      return;
    }

    if (activeCryptoIndex > topCryptos.length - 1) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, topCryptos.length]);

  const isBooting = dashboardQuery.isPending && !dashboard;

  const renderCryptoGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!topCryptos.length) {
      return <p className="muted">No crypto data available.</p>;
    }

    return (
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

    if (!topStocks.length) {
      return <p className="muted">No stock data available.</p>;
    }

    return (
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
              valueLabel="Market Cap"
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
      </div>
    );
  };

  const renderEtfGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!topEtfs.length) {
      return <p className="muted">No ETF data available.</p>;
    }

    return (
      <div className="coin-grid">
        {topEtfs.map((etf, index) => {
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
              valueLabel="AUM"
              value={formatCompactCurrency(etf.aumUsd)}
              secondary={hasChange ? changeText : "Fund ranking"}
              secondaryClassName={hasChange ? clsx("coin-change", trendClass(etf.changePercent)) : "asset-note"}
              index={index}
              logoUrl={etf.logoUrl}
              fallbackLogoUrls={etf.fallbackLogoUrls}
              assetStyle
            />
          );
        })}
      </div>
    );
  };

  const renderCurrencyGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!topCurrencies.length) {
      return <p className="muted">No currency data available.</p>;
    }

    return (
      <div className="coin-grid">
        {topCurrencies.map((currency, index) => (
          <MarketCard
            key={currency.id}
            id={currency.id}
            rank={currency.rank}
            name={currency.name}
            symbol={currency.symbol}
            meta={currency.category}
            valueLabel="Rate vs USD"
            value={formatCurrency(currency.rateVsUsd)}
            secondary={formatPercent(currency.changePercent)}
            secondaryClassName={clsx("coin-change", trendClass(currency.changePercent))}
            index={index}
            logoUrl={currency.logoUrl}
            fallbackLogoUrls={currency.fallbackLogoUrls}
            assetStyle
          />
        ))}
      </div>
    );
  };

  const renderAssetGrid = () => {
    if (isBooting) {
      return <SkeletonGrid />;
    }

    if (!topAssets.length) {
      return <p className="muted">No asset data available.</p>;
    }

    return (
      <div className="coin-grid">
        {topAssets.map((asset, index) => (
          <MarketCard
            key={asset.id}
            id={asset.id}
            rank={asset.rank}
            name={asset.name}
            symbol={asset.symbol}
            meta={asset.category}
            valueLabel="Est. Market Cap"
            value={formatCompactCurrency(asset.marketCapUsd)}
            secondary="Estimated market cap"
            secondaryClassName="asset-note"
            index={index}
            logoUrl={asset.logoUrl}
            fallbackLogoUrls={asset.fallbackLogoUrls}
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
    <main className="shell">
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
        <p className="tagline">Top 10 global assets, stocks, ETFs, currencies, cryptocurrencies, and NIGHT price.</p>
      </header>

      <nav className="section-nav" aria-label="Dashboard sections">
        <a href="#section-assets" className={clsx(activeSection === "section-assets" && "nav-active")}>Global Assets</a>
        <a href="#section-stocks" className={clsx(activeSection === "section-stocks" && "nav-active")}>Stocks</a>
        <a href="#section-etfs" className={clsx(activeSection === "section-etfs" && "nav-active")}>ETFs</a>
        <a href="#section-currencies" className={clsx(activeSection === "section-currencies" && "nav-active")}>Currencies</a>
        <a href="#section-cryptos" className={clsx(activeSection === "section-cryptos" && "nav-active")}>Cryptos</a>
        <a href="#section-night" className={clsx(activeSection === "section-night" && "nav-active")}>NIGHT</a>
      </nav>

      <motion.section id="section-assets" className="surface global-assets-surface" {...SECTION_REVEAL}>
        <SectionHeader title="Top 10 Global Assets" subtitle="By estimated market cap" />
        {renderAssetGrid()}
        <p className="disclaimer">* Approximate values. Network/API conditions may delay updates.</p>
      </motion.section>

      <motion.section id="section-stocks" className="surface stocks-surface" {...SECTION_REVEAL}>
        <SectionHeader title="Top 10 Stocks" subtitle="By estimated market cap" />
        {renderStockGrid()}
      </motion.section>

      <motion.section id="section-etfs" className="surface etfs-surface" {...SECTION_REVEAL}>
        <SectionHeader title="Top 10 ETFs" subtitle="By assets under management" />
        {renderEtfGrid()}
      </motion.section>

      <motion.section id="section-currencies" className="surface currencies-surface" {...SECTION_REVEAL}>
        <SectionHeader title="Top 10 Currencies" subtitle="Exchange rates vs USD" />
        {renderCurrencyGrid()}
      </motion.section>

      <motion.section id="section-cryptos" className="surface cryptos-surface" {...SECTION_REVEAL}>
        <SectionHeader title="Top 10 Cryptocurrencies" subtitle="Live market feed" />
        {renderCryptoGrid()}
      </motion.section>

      <motion.section id="section-night" className="surface midnight-surface night-ticker" {...SECTION_REVEAL}>
        {night ? (
          <div className="night-ticker-row">
            <LogoMark name="NIGHT" symbol={night.symbol} logoUrl={night.logoUrl} fallbackLogoUrls={night.fallbackLogoUrls} />
            <span className="night-ticker-name">NIGHT</span>
            <span className="night-ticker-price">{formatCurrency(night.priceUsd)}</span>
            <span className={clsx("night-ticker-change", trendClass(night.change24h))}>{formatPercent(night.change24h)}</span>
            <span className="night-ticker-divider" aria-hidden="true" />
            <span className="night-ticker-stat"><span>MCap</span> {formatCompactCurrency(night.marketCapUsd)}</span>
            <span className="night-ticker-stat"><span>Vol</span> {formatCompactCurrency(night.volume24hUsd)}</span>
            <span className="night-ticker-stat"><span>ATH</span> {formatCurrency(night.athPriceUsd)}</span>
            <span className={clsx("night-ticker-stat", trendClass(night.percentFromAth))}><span>From ATH</span> {formatPercent(night.percentFromAth)}</span>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Waiting for NIGHT feed...</p>
        )}
      </motion.section>

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
              <span>Financial Modeling Prep</span>
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

import clsx from "clsx";
import { motion } from "framer-motion";

import { LogoMark } from "./LogoMark";
import { buildPriceTitle } from "../lib/dashboard-filters";
import {
  formatCompactCurrency,
  formatCurrency,
  formatExactCurrency,
  formatExactNumber,
  formatPercent,
  trendClass,
} from "../lib/formatters";
import type { DashboardNight } from "../types/dashboard";

const REVEAL = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

type NightTickerProps = {
  night: DashboardNight | null;
  generatedAt: string | undefined;
  onOpenDetail: (id: string) => void;
};

export function NightTicker({ night, generatedAt, onOpenDetail }: NightTickerProps) {
  return (
    <motion.section id="section-night" className="surface midnight-surface night-ticker" {...REVEAL}>
      {night ? (
        <div className="night-ticker-row">
          <LogoMark name="NIGHT" symbol={night.symbol} logoUrl={night.logoUrl} fallbackLogoUrls={night.fallbackLogoUrls} />
          <span className="night-ticker-name">NIGHT</span>
          <span className="night-ticker-price" title={buildPriceTitle(formatExactCurrency(night.priceUsd), generatedAt)}>
            {formatCurrency(night.priceUsd)}
          </span>
          <span className={clsx("night-ticker-change", trendClass(night.change24h))} title="24h change">
            {formatPercent(night.change24h)}
          </span>
          <span className="night-ticker-divider" aria-hidden="true" />
          <span className="night-ticker-stat" title={`Exact market cap: ${formatExactNumber(night.marketCapUsd)} USD`}>
            <span>MCap</span> {formatCompactCurrency(night.marketCapUsd)}
          </span>
          <span className="night-ticker-stat" title={`Exact 24h volume: ${formatExactNumber(night.volume24hUsd)} USD`}>
            <span>Vol</span> {formatCompactCurrency(night.volume24hUsd)}
          </span>
          <span className="night-ticker-stat" title={`Exact ATH: ${formatExactCurrency(night.athPriceUsd)}`}>
            <span>ATH</span> {formatCurrency(night.athPriceUsd)}
          </span>
          <span className={clsx("night-ticker-stat", trendClass(night.percentFromAth))} title="Percent from all-time high">
            <span>From ATH</span> {formatPercent(night.percentFromAth)}
          </span>
          <button type="button" className="night-detail-button" onClick={() => onOpenDetail(night.id)}>Details</button>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Waiting for NIGHT feed...</p>
      )}
    </motion.section>
  );
}

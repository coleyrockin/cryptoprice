import clsx from "clsx";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

import { LogoMark } from "./LogoMark";

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
  logoUrl?: string | null;
  fallbackLogoUrls?: string[];
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
  assetStyle?: boolean;
};

export function MarketCard({
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
  assetStyle = false,
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
      <article key={id} className={clsx("coin-card", assetStyle && "asset-card")} style={cardStyle}>
        {content}
      </article>
    );
  }

  return (
    <motion.button
      key={id}
      type="button"
      className={clsx("coin-card", "interactive-card", active && "active", assetStyle && "asset-card")}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.22 }}
      style={cardStyle}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Show ${name} details`}
    >
      {content}
    </motion.button>
  );
}

import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo, type CSSProperties, type ReactNode } from "react";

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
  pinned?: boolean;
  onTogglePin?: () => void;
  compared?: boolean;
  onToggleCompare?: () => void;
  sparkline?: number[];
};

function renderSparkline(points: number[]): ReactNode {
  // Early return for insufficient data
  if (points.length < 2) {
    return null;
  }

  const safePoints = points.map((point) => (Number.isFinite(point) ? point : 0));
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = Math.max(1, max - min);

  const polyline = safePoints
    .map((point, index) => {
      const x = (index / (safePoints.length - 1)) * 100;
      const y = 24 - ((point - min) / range) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="card-sparkline" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={polyline} />
    </svg>
  );
}

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
  pinned = false,
  onTogglePin,
  compared = false,
  onToggleCompare,
  sparkline,
}: MarketCardProps) {
  const cardStyle = {
    "--card-index": index,
  } as CSSProperties;

  // Memoize sparkline rendering to avoid recalculation on every render
  const sparklineElement = useMemo(() => {
    return Array.isArray(sparkline) && sparkline.length > 1 ? renderSparkline(sparkline) : null;
  }, [sparkline]);

  const actionButtons = (
    <div className="card-actions">
      {onTogglePin ? (
        <button
          type="button"
          className={clsx("card-chip", pinned && "active")}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${name} from watchlist` : `Pin ${name} to watchlist`}
        >
          {pinned ? "Pinned" : "Pin"}
        </button>
      ) : null}

      {onToggleCompare ? (
        <button
          type="button"
          className={clsx("card-chip", compared && "active")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCompare();
          }}
          aria-pressed={compared}
          aria-label={compared ? `Remove ${name} from compare` : `Add ${name} to compare`}
        >
          {compared ? "Comparing" : "Compare"}
        </button>
      ) : null}
    </div>
  );

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

      <div className="coin-foot">
        {actionButtons}
        {sparklineElement}
      </div>
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
    <motion.article
      key={id}
      className={clsx("coin-card", "interactive-card", active && "active", assetStyle && "asset-card")}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.22 }}
      style={cardStyle}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      aria-pressed={active}
      aria-label={`Show ${name} details`}
    >
      {content}
    </motion.article>
  );
}

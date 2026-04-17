import clsx from "clsx";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { useTilt } from "../hooks/useTilt";
import { LogoMark } from "./LogoMark";

type MarketCardProps = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  meta: string;
  value: string;
  valueLabel?: string;
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

function renderSparkline(points: number[], cardId: string): ReactNode {
  // Early return for insufficient data
  if (points.length < 2) {
    return null;
  }

  const safePoints = points.map((point) => (Number.isFinite(point) ? point : 0));
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = Math.max(1, max - min);
  const trendUp = safePoints[safePoints.length - 1] >= safePoints[0];

  const strokeColor = trendUp ? "rgba(80, 215, 155, 0.9)" : "rgba(255, 90, 120, 0.9)";
  const fillColorTop = trendUp ? "rgba(80, 215, 155, 0.35)" : "rgba(255, 90, 120, 0.3)";
  const gradientId = `sg-${cardId}`;

  const coords = safePoints.map((point, index) => {
    const x = (index / (safePoints.length - 1)) * 100;
    const y = 26 - ((point - min) / range) * 22;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Build a closed polygon for the fill area (line + bottom edge)
  const fillPath = coords.map((c) => `${c.x},${c.y}`).join(" ") + ` 100,26 0,26`;

  return (
    <svg className="card-sparkline" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColorTop} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill={`url(#${gradientId})`} stroke="none" />
      <polyline points={polyline} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
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
  valueLabel,
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
  const tilt = useTilt();
  const priceRef = useRef<HTMLParagraphElement>(null);
  const prevValueRef = useRef<string>(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    const isInitial = prevValueRef.current === undefined;
    prevValueRef.current = value;
    if (isInitial) return;
    const el = priceRef.current;
    if (!el) return;
    el.classList.remove("coin-price--pulse");
    // Force reflow so the class re-addition re-triggers the animation
    void el.offsetWidth;
    el.classList.add("coin-price--pulse");
  }, [value]);

  const cardStyle = {
    "--card-index": index,
  } as CSSProperties;

  // Memoize sparkline rendering to avoid recalculation on every render
  const sparklineElement = useMemo(() => {
    return Array.isArray(sparkline) && sparkline.length > 1 ? renderSparkline(sparkline, id) : null;
  }, [sparkline, id]);

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
        <span className="asset-category" data-category={meta.toLowerCase()}>{meta}</span>
      </div>

      <div className="coin-title-row">
        <div className="coin-title-main">
          <LogoMark name={name} symbol={symbol} logoUrl={logoUrl} fallbackLogoUrls={fallbackLogoUrls} />
          <h3>{name}</h3>
        </div>
        <span className="symbol-pill">{symbol}</span>
      </div>

      {valueLabel ? <p className="coin-value-label">{valueLabel}</p> : null}
      <p ref={priceRef} className="coin-price">{value}</p>
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
      ref={tilt.ref as React.RefObject<HTMLElement>}
      key={id}
      className={clsx("coin-card", "interactive-card", active && "active", assetStyle && "asset-card")}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.22 }}
      style={{ ...cardStyle, ...tilt.style }}
      onClick={onClick}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
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

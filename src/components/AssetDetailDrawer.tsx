import clsx from "clsx";

import { formatCompactCurrency, formatCurrency, formatExactCurrency, formatPercent, trendClass } from "../lib/formatters";
import type { AssetDetailPayload, HistoricalRange } from "../types/dashboard";

const RANGES: HistoricalRange[] = ["7D", "30D", "1Y"];

type AssetDetailDrawerProps = {
  detail: AssetDetailPayload | undefined;
  isLoading: boolean;
  error: Error | null;
  range: HistoricalRange;
  onRangeChange: (range: HistoricalRange) => void;
  onClose: () => void;
};

function HistoryChart({ points }: { points: AssetDetailPayload["history"]["points"] }) {
  const safePoints = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
  if (safePoints.length < 2) return null;

  const values = safePoints.map((point) => point.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 42 - ((value - min) / range) * 36;
    return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
  });

  return (
    <svg className="detail-chart" viewBox="0 0 100 48" preserveAspectRatio="none" aria-label="Historical price chart">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function formatSourceType(value: string | undefined): string {
  if (!value) return "—";
  return value.replace(/-/g, " ");
}

export function AssetDetailDrawer({ detail, isLoading, error, range, onRangeChange, onClose }: AssetDetailDrawerProps) {
  return (
    <div className="detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="asset-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="detail-head">
          <div>
            <p className="detail-eyebrow">Asset detail</p>
            <h2 id="asset-detail-title">{detail?.asset.displayName ?? "Loading asset"}</h2>
            {detail ? <p>{detail.asset.symbol} · {detail.asset.category}</p> : null}
          </div>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Close asset detail">×</button>
        </div>

        {isLoading ? <p className="muted">Loading detail and provenance...</p> : null}
        {error ? <p className="filter-empty">Asset detail is unavailable right now.</p> : null}

        {detail ? (
          <>
            <div className="detail-metrics">
              <div>
                <span>{detail.quote.valueLabel}</span>
                <strong>{formatCompactCurrency(detail.quote.valueUsd)}</strong>
              </div>
              <div>
                <span>Unit price</span>
                <strong>{detail.quote.priceUsd === undefined ? "—" : formatCurrency(detail.quote.priceUsd)}</strong>
              </div>
              <div>
                <span>Change</span>
                <strong className={trendClass(detail.quote.changePercent)}>{formatPercent(detail.quote.changePercent)}</strong>
              </div>
            </div>

            <div className="detail-range-row" aria-label="History range">
              {RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={clsx("detail-range", range === option && "active")}
                  onClick={() => onRangeChange(option)}
                  aria-pressed={range === option}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="detail-panel">
              <div className="detail-panel-head">
                <span>History</span>
                <span>{detail.history.range}</span>
              </div>
              {detail.history.available ? (
                <>
                  <HistoryChart points={detail.history.points} />
                  <p className="detail-chart-meta">
                    {detail.history.points.length} points · latest {formatExactCurrency(detail.history.points[detail.history.points.length - 1]?.value)}
                  </p>
                </>
              ) : (
                <p className="detail-unavailable">{detail.history.reason ?? "History unavailable from the current provider set."}</p>
              )}
            </div>

            <div className="detail-provenance">
              <div><span>Provider</span><strong>{detail.provenance.provider}</strong></div>
              <div><span>Source</span><strong>{detail.provenance.source}</strong></div>
              <div><span>Confidence</span><strong>{detail.provenance.confidence}</strong></div>
              <div><span>Method</span><strong>{detail.provenance.valueMethod}</strong></div>
              <div><span>Verified as of</span><strong>{detail.provenance.valueAsOf ?? detail.quote.asOf.slice(0, 10)}</strong></div>
              <div><span>Source type</span><strong>{formatSourceType(detail.provenance.sourceType)}</strong></div>
            </div>
            {detail.provenance.sourceUrl ? (
              <a className="detail-source-link" href={detail.provenance.sourceUrl} target="_blank" rel="noreferrer">
                {detail.provenance.sourceTitle ?? "Open source"}
              </a>
            ) : null}
            {detail.provenance.alternateValuations?.length ? (
              <div className="detail-alternates">
                <span>Alternate context</span>
                {detail.provenance.alternateValuations.map((valuation) => (
                  <p key={`${valuation.valueUsd}-${valuation.valueAsOf}`}>
                    {formatCompactCurrency(valuation.valueUsd)} {formatSourceType(valuation.sourceType)} · {valuation.notes}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="detail-limitation">{detail.provenance.limitation}</p>
            {detail.degradedReason ? <p className="detail-degraded">{detail.degradedReason}</p> : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}

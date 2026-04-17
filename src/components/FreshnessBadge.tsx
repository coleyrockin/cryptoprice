import { useEffect, useState } from "react";
import clsx from "clsx";

import type { DashboardSegmentMeta } from "../types/dashboard";

type FreshnessBadgeProps = {
  meta: DashboardSegmentMeta;
  generatedAt: string;
};

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

type Variant = "live" | "cached" | "degraded";

function variantFor(source: DashboardSegmentMeta["source"]): Variant {
  if (source === "live" || source === "fresh-cache") return "live";
  if (source === "stale-cache" || source === "durable-cache") return "cached";
  return "degraded";
}

function labelFor(source: DashboardSegmentMeta["source"]): string {
  switch (source) {
    case "live":
      return "Live";
    case "fresh-cache":
      return "Live";
    case "stale-cache":
      return "Stale cache";
    case "durable-cache":
      return "Durable cache";
    case "fallback":
      return "Fallback";
  }
}

export function FreshnessBadge({ meta, generatedAt }: FreshnessBadgeProps) {
  const baseMs = Date.parse(generatedAt);
  const baseAgeSec = meta.ageSec;

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tickSec = Number.isFinite(baseMs) ? Math.max(0, Math.floor((nowMs - baseMs) / 1000)) : 0;
  const ageSec = baseAgeSec + tickSec;
  const variant = variantFor(meta.source);
  const label = labelFor(meta.source);

  return (
    <span
      className={clsx("freshness-badge", `freshness-badge--${variant}`)}
      title={`Source: ${meta.source}`}
      aria-label={`Data source: ${label}, ${formatAge(ageSec)}`}
    >
      <span className="freshness-dot" aria-hidden="true" />
      <span className="freshness-label">{label}</span>
      <span className="freshness-age">· {formatAge(ageSec)}</span>
    </span>
  );
}

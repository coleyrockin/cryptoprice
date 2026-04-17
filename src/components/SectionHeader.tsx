import { FreshnessBadge } from "./FreshnessBadge";
import { LogoMark } from "./LogoMark";
import type { DashboardSegmentMeta } from "../types/dashboard";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  accentSymbol?: string;
  accentLogoUrl?: string | null;
  accentFallbackLogoUrls?: string[];
  meta?: DashboardSegmentMeta;
  generatedAt?: string;
};

export function SectionHeader({
  title,
  subtitle,
  accentSymbol,
  accentLogoUrl,
  accentFallbackLogoUrls,
  meta,
  generatedAt,
}: SectionHeaderProps) {
  return (
    <div className="surface-head">
      <div className="surface-title-row">
        <h2>{title}</h2>
        {accentSymbol || accentLogoUrl || accentFallbackLogoUrls?.length ? (
          <div className="surface-title-accent">
            <LogoMark
              name={`${title} accent`}
              symbol={accentSymbol ?? title}
              logoUrl={accentLogoUrl ?? null}
              fallbackLogoUrls={accentFallbackLogoUrls}
            />
            {accentSymbol ? <span className="symbol-pill surface-symbol">{accentSymbol}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="surface-head-meta">
        <p>{subtitle}</p>
        {meta && generatedAt ? <FreshnessBadge meta={meta} generatedAt={generatedAt} /> : null}
      </div>
    </div>
  );
}

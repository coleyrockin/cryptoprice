import { LogoMark } from "./LogoMark";

type SectionHeaderProps = {
  title: string;
  subtitle: string;
  accentSymbol?: string;
  accentLogoUrl?: string | null;
  accentFallbackLogoUrls?: string[];
};

export function SectionHeader({
  title,
  subtitle,
  accentSymbol,
  accentLogoUrl,
  accentFallbackLogoUrls,
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
      <p>{subtitle}</p>
    </div>
  );
}

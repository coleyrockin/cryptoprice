import { useEffect, useMemo, useState } from "react";

import { normalizeMonogram } from "../lib/monogram";

type LogoMarkProps = {
  name: string;
  symbol: string;
  logoUrl?: string | null;
  fallbackLogoUrls?: string[];
};

function logoSourceUrl(source: string): string {
  if (!import.meta.env.PROD) {
    return source;
  }

  if (!/^https?:\/\//i.test(source)) {
    return source;
  }

  return `/api/logo?url=${encodeURIComponent(source)}`;
}

export function LogoMark({ name, symbol, logoUrl, fallbackLogoUrls = [] }: LogoMarkProps) {
  const [logoIndex, setLogoIndex] = useState(0);

  const sources = useMemo(
    () => [logoUrl, ...fallbackLogoUrls].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    [fallbackLogoUrls, logoUrl],
  );

  useEffect(() => {
    setLogoIndex(0);
  }, [sources, symbol]);

  const currentSource = sources[logoIndex];

  if (!currentSource) {
    return (
      <span className="logo-fallback" aria-hidden="true">
        {normalizeMonogram(symbol)}
      </span>
    );
  }

  return (
    <img
      src={logoSourceUrl(currentSource)}
      alt={`${name} logo`}
      className="asset-logo"
      loading="lazy"
      onError={() => {
        setLogoIndex((previous) => previous + 1);
      }}
    />
  );
}

import { memo } from "react";

import { PinnedCard } from "./SectionGrid";
import type { DashboardEntry } from "../lib/dashboard-insights";

type WatchlistSectionProps = {
  entries: DashboardEntry[];
  pinnedIdSet: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  generatedAt: string | undefined;
  selectedAssetId: string | null;
  onOpenAssetDetail: (id: string) => void;
};

export const WatchlistSection = memo(function WatchlistSection({
  entries,
  pinnedIdSet,
  onTogglePin,
  generatedAt,
  selectedAssetId,
  onOpenAssetDetail,
}: WatchlistSectionProps) {
  if (!entries.length) return null;

  return (
    <section
      id="section-watchlist"
      className="surface watchlist-surface"
      aria-labelledby="watchlist-heading"
    >
      <div className="surface-head">
        <div className="surface-title-row">
          <h2 id="watchlist-heading">Pinned Watchlist</h2>
        </div>
        <div className="surface-head-meta">
          <p>
            {entries.length} pinned market{entries.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="coin-grid watchlist-grid">
        {entries.map((entry, index) => (
          <PinnedCard
            key={`pinned-${entry.id}`}
            entry={entry}
            index={index}
            pinnedIdSet={pinnedIdSet}
            onTogglePin={onTogglePin}
            generatedAt={generatedAt}
            selectedAssetId={selectedAssetId}
            onOpenAssetDetail={onOpenAssetDetail}
          />
        ))}
      </div>
    </section>
  );
});

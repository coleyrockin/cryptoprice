import { motion } from "framer-motion";

import { PinnedCard } from "./SectionGrid";
import type { DashboardEntry } from "../lib/dashboard-insights";

const REVEAL = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

type WatchlistSectionProps = {
  entries: DashboardEntry[];
  pinnedIdSet: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  generatedAt: string | undefined;
  selectedAssetId: string | null;
  onOpenAssetDetail: (id: string) => void;
};

export function WatchlistSection({
  entries,
  pinnedIdSet,
  onTogglePin,
  generatedAt,
  selectedAssetId,
  onOpenAssetDetail,
}: WatchlistSectionProps) {
  if (!entries.length) return null;

  return (
    <motion.section
      id="section-watchlist"
      className="surface watchlist-surface"
      aria-labelledby="watchlist-heading"
      {...REVEAL}
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
    </motion.section>
  );
}

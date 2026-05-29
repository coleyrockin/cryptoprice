import clsx from "clsx";
import { memo, type RefObject } from "react";

import { useNow } from "../hooks/useNow";
import {
  SECTION_FILTERS,
  SORT_OPTIONS,
  type DensityMode,
  type SectionFilter,
  formatRelativeTime,
} from "../lib/dashboard-filters";
import type { DashboardSortMode } from "../lib/dashboard-insights";

type MarketControlsProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  sectionFilter: SectionFilter;
  onSectionFilterChange: (value: SectionFilter) => void;
  sortMode: DashboardSortMode;
  onSortChange: (value: DashboardSortMode) => void;
  density: DensityMode;
  onDensityToggle: () => void;
  isFetching: boolean;
  generatedAt: string | undefined;
};

/**
 * Isolated "Updated Xs ago" status. It is the ONLY thing that ticks with the
 * shared clock, so the second-by-second relative time never re-renders the rest
 * of the toolbar or the dashboard. No `aria-live` — a fresh announcement every
 * second is screen-reader spam; the timestamp is in the tooltip for those who want it.
 */
const RefreshStatus = memo(function RefreshStatus({
  generatedAt,
  isFetching,
}: {
  generatedAt: string | undefined;
  isFetching: boolean;
}) {
  const now = useNow();
  return (
    <span
      className={clsx("toolbar-updated", isFetching && "is-fetching")}
      title={generatedAt ? `Last update: ${new Date(generatedAt).toLocaleString()}` : "Waiting for first update"}
    >
      <span className="toolbar-updated-dot" aria-hidden="true" />
      <span className="toolbar-updated-label">{isFetching ? "Refreshing" : "Updated"}</span>
      <span className="toolbar-updated-value">{formatRelativeTime(generatedAt, now)}</span>
    </span>
  );
});

export const MarketControls = memo(function MarketControls({
  searchTerm,
  onSearchChange,
  searchInputRef,
  sectionFilter,
  onSectionFilterChange,
  sortMode,
  onSortChange,
  density,
  onDensityToggle,
  isFetching,
  generatedAt,
}: MarketControlsProps) {
  return (
    <section className="dashboard-toolbar" aria-label="Dashboard controls">
      <label className="market-search">
        <span>Search</span>
        <input
          ref={searchInputRef}
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search markets"
          placeholder="BTC, Apple, ETF, currency..."
        />
        {searchTerm ? (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              onSearchChange("");
              searchInputRef.current?.focus();
            }}
          >
            ×
          </button>
        ) : (
          <kbd className="search-kbd" aria-hidden="true" title="Press / to focus search">/</kbd>
        )}
      </label>

      <div className="control-cluster" aria-label="Section filter">
        {SECTION_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={clsx("segmented-button", sectionFilter === filter.value && "active")}
            onClick={() => onSectionFilterChange(filter.value)}
            aria-pressed={sectionFilter === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="market-select">
        <span>Sort</span>
        <select
          value={sortMode}
          onChange={(event) => onSortChange(event.target.value as DashboardSortMode)}
          aria-label="Sort markets"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={clsx("density-toggle", density === "compact" && "active")}
        onClick={onDensityToggle}
        aria-pressed={density === "compact"}
      >
        {density === "compact" ? "Comfort" : "Compact"}
      </button>

      <RefreshStatus generatedAt={generatedAt} isFetching={isFetching} />
    </section>
  );
});

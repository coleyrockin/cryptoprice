import { SectionGrid } from "./SectionGrid";
import type { SectionFilter } from "../lib/dashboard-filters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardSegmentMeta,
  DashboardStock,
} from "../types/dashboard";

type SegmentMetaMap = {
  topStocks?: DashboardSegmentMeta;
  topEtfs?: DashboardSegmentMeta;
  topCurrencies?: DashboardSegmentMeta;
  topCryptos?: DashboardSegmentMeta;
  topPrivateCompanies?: DashboardSegmentMeta;
};

type MarketSectionsProps = {
  shouldShowSection: (filter: Exclude<SectionFilter, "all">) => boolean;
  generatedAt: string | undefined;
  isBooting: boolean;
  normalizedSearchTerm: string;
  pinnedIdSet: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  selectedAssetId: string | null;
  onOpenAssetDetail: (id: string) => void;
  segmentMeta: SegmentMetaMap | undefined;
  equityEstimateLabel: string;

  topAssets: DashboardAsset[];
  visibleTopAssets: DashboardAsset[];

  topStocks: DashboardStock[];
  visibleTopStocks: DashboardStock[];

  topPrivateCompanies: DashboardPrivateCompany[];
  visibleTopPrivateCompanies: DashboardPrivateCompany[];

  topEtfs: DashboardEtf[];
  visibleTopEtfs: DashboardEtf[];

  topCurrencies: DashboardCurrency[];
  visibleTopCurrencies: DashboardCurrency[];

  topCryptos: DashboardCrypto[];
  visibleTopCryptos: DashboardCrypto[];
  activeCryptoId: string;
  onCryptoActivate: (id: string) => void;
};

/**
 * Renders the six market sections (Global Assets, Public Companies,
 * Private Companies, ETFs, Currencies, Cryptos) in order, honoring the
 * current section filter. Shared card-context props are forwarded once
 * to each SectionGrid.
 */
export function MarketSections(props: MarketSectionsProps) {
  const {
    shouldShowSection,
    generatedAt,
    isBooting,
    normalizedSearchTerm,
    pinnedIdSet,
    onTogglePin,
    selectedAssetId,
    onOpenAssetDetail,
    segmentMeta,
    equityEstimateLabel,
  } = props;

  const common = {
    generatedAt,
    isBooting,
    normalizedSearchTerm,
    pinnedIdSet,
    onTogglePin,
    selectedAssetId,
    onOpenAssetDetail,
  };

  return (
    <>
      {shouldShowSection("assets") ? (
        <SectionGrid
          {...common}
          id="section-assets"
          surfaceClass="global-assets-surface"
          title="Global Asset Leaders"
          subtitle={equityEstimateLabel}
          meta={segmentMeta?.topStocks}
          totalCount={props.topAssets.length}
          visibleEntries={props.visibleTopAssets}
          variant="assets"
          emptyLabel="global assets"
          footerNote="* Approximate values. Network/API conditions may delay updates."
        />
      ) : null}

      {shouldShowSection("stocks") ? (
        <SectionGrid
          {...common}
          id="section-stocks"
          surfaceClass="stocks-surface"
          title="Top Public Companies"
          subtitle={equityEstimateLabel}
          meta={segmentMeta?.topStocks}
          totalCount={props.topStocks.length}
          visibleEntries={props.visibleTopStocks}
          variant="stocks"
          emptyLabel="public companies"
        />
      ) : null}

      {shouldShowSection("private") ? (
        <SectionGrid
          {...common}
          id="section-private-companies"
          surfaceClass="private-companies-surface"
          title="Top Private Companies"
          subtitle="Verified primary valuations; targets stay secondary"
          meta={segmentMeta?.topPrivateCompanies}
          totalCount={props.topPrivateCompanies.length}
          visibleEntries={props.visibleTopPrivateCompanies}
          variant="private"
          emptyLabel="private companies"
        />
      ) : null}

      {shouldShowSection("etfs") ? (
        <SectionGrid
          {...common}
          id="section-etfs"
          surfaceClass="etfs-surface"
          title="Top 10 ETFs"
          subtitle={equityEstimateLabel}
          meta={segmentMeta?.topEtfs}
          totalCount={props.topEtfs.length}
          visibleEntries={props.visibleTopEtfs}
          variant="etfs"
          emptyLabel="ETFs"
        />
      ) : null}

      {shouldShowSection("currencies") ? (
        <SectionGrid
          {...common}
          id="section-currencies"
          surfaceClass="currencies-surface"
          title="Top 10 Currencies"
          subtitle="Exchange rates vs USD"
          meta={segmentMeta?.topCurrencies}
          totalCount={props.topCurrencies.length}
          visibleEntries={props.visibleTopCurrencies}
          variant="currencies"
          emptyLabel="currencies"
        />
      ) : null}

      {shouldShowSection("cryptos") ? (
        <SectionGrid
          {...common}
          id="section-cryptos"
          surfaceClass="cryptos-surface"
          title="Top 10 Cryptocurrencies"
          subtitle="Live market feed"
          meta={segmentMeta?.topCryptos}
          totalCount={props.topCryptos.length}
          visibleEntries={props.visibleTopCryptos}
          variant="cryptos"
          emptyLabel="cryptocurrencies"
          activeCryptoId={props.activeCryptoId}
          onCryptoActivate={props.onCryptoActivate}
        />
      ) : null}
    </>
  );
}

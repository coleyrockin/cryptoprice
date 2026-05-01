import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDashboard } from "./api";
import App from "./App";
import type { DashboardPayload } from "./types/dashboard";

vi.mock("./api", () => ({
  fetchDashboard: vi.fn(),
}));

const mockedFetchDashboard = vi.mocked(fetchDashboard);

const payload: DashboardPayload = {
  generatedAt: "2026-02-16T00:00:00.000Z",
  stale: false,
  refreshInSec: 30,
  source: {
    equities: "fmp",
    crypto: "coinpaprika",
    fallbackUsed: false,
  },
  degradedSegments: [],
  segmentMeta: {
    topCryptos: {
      source: "live",
      ageSec: 0,
    },
    topStocks: {
      source: "live",
      ageSec: 0,
    },
    topEtfs: {
      source: "live",
      ageSec: 0,
    },
    topCurrencies: {
      source: "live",
      ageSec: 0,
    },
    night: {
      source: "live",
      ageSec: 0,
    },
  },
  topCryptos: [
    {
      id: "btc-bitcoin",
      rank: 1,
      name: "Bitcoin",
      symbol: "BTC",
      category: "Crypto",
      priceUsd: null,
      marketCapUsd: 123,
      change24h: null,
      sparkline7d: [],
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  topStocks: [
    {
      id: "stock-aapl",
      rank: 1,
      name: "Apple",
      symbol: "AAPL",
      category: "Stock",
      marketCapUsd: null,
      priceUsd: null,
      changePercent: null,
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  topEtfs: [],
  topCurrencies: [],
  topAssets: [
    {
      id: "commodity-gold",
      rank: 1,
      name: "Gold",
      symbol: "XAU",
      category: "Commodity",
      marketCapUsd: null,
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  night: {
    id: "night-midnight2",
    name: "Midnight",
    symbol: "NIGHT",
    logoUrl: null,
    fallbackLogoUrls: [],
    priceUsd: null,
    marketCapUsd: null,
    volume24hUsd: null,
    athPriceUsd: null,
    change24h: null,
    percentFromAth: null,
  },
};

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  beforeEach(() => {
    mockedFetchDashboard.mockReset();
    mockedFetchDashboard.mockResolvedValue(payload);
    localStorage.clear();
  });

  it("renders safely with missing numbers and keeps ticker pills visible", async () => {
    renderApp();

    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getAllByText("XAU").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("filters visible market cards by search text", async () => {
    renderApp();

    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search markets"), {
      target: { value: "apple" },
    });

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();
    expect(screen.getByText('No cryptocurrencies match "apple".')).toBeInTheDocument();
  });

  it("pins markets into a watchlist section", async () => {
    renderApp();

    await screen.findByText("Apple");
    fireEvent.click(screen.getByRole("button", { name: "Pin Apple to watchlist" }));

    const watchlist = screen.getByRole("region", { name: "Pinned Watchlist" });
    expect(within(watchlist).getByText("Apple")).toBeInTheDocument();
    expect(within(watchlist).getByRole("button", { name: "Unpin Apple from watchlist" })).toBeInTheDocument();
  });
});

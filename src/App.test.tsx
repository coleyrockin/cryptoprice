import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
  refreshInSec: 60,
  source: {
    equities: "fmp",
    crypto: "coinpaprika",
    fallbackUsed: false,
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
  });

  it("renders safely with missing numbers and keeps ticker pills visible", async () => {
    renderApp();

    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getAllByText("XAU").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

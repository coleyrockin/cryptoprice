# Top 10 Currencies — Design Spec

## Overview

Add a "Top 10 Currencies" section to the World Asset Prices dashboard, ranked by daily forex trading volume. Positioned between Stocks and Cryptos. Uses FMP forex API (already integrated for stocks).

## Data Source

**FMP `/v3/quotes/forex`** — returns forex pair quotes with rate, change, changePercent, and volume.

**Top 10 currencies by daily forex volume (hardcoded ranking):**

| Rank | Currency | Symbol | Flag |
|------|----------|--------|------|
| 1 | US Dollar | USD | US |
| 2 | Euro | EUR | EU |
| 3 | Japanese Yen | JPY | JP |
| 4 | British Pound | GBP | GB |
| 5 | Australian Dollar | AUD | AU |
| 6 | Canadian Dollar | CAD | CA |
| 7 | Swiss Franc | CHF | CH |
| 8 | Chinese Yuan | CNY | CN |
| 9 | Hong Kong Dollar | HKD | HK |
| 10 | New Zealand Dollar | NZD | NZ |

**Pair normalization:** FMP returns pairs like `EURUSD`, `USDJPY`. For each currency, find the pair vs USD:
- If pair is `XXXUSD` (e.g. EURUSD): rate = price (1 EUR = X USD)
- If pair is `USDXXX` (e.g. USDJPY): rate = 1/price (1 JPY = 1/price USD), changePercent is negated (USD strengthening = JPY weakening)
- USD itself: rate is 1.00, change is 0%, rank #1

Display convention: show "1 XXX = Y USD" for all currencies. This makes comparison intuitive.

## Backend Changes

### New type: `DashboardCurrency`

```typescript
type DashboardCurrency = {
  id: string;           // e.g. "currency-eur"
  rank: number;
  name: string;         // e.g. "Euro"
  symbol: string;       // e.g. "EUR"
  category: "currency";
  rateVsUsd: number;    // 1 unit of this currency in USD
  changePercent: number | null; // 24h change %
  dailyVolume: number | null;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
};
```

### New function: `fetchTopCurrencies()`

In `server/providers/fmp.ts`:
- Call FMP `/v3/quotes/forex` with the API key
- Filter for the 10 target pairs (EURUSD, USDJPY, GBPUSD, etc.)
- Normalize rates so all are expressed as "1 XXX = Y USD"
- Return `DashboardCurrency[]` sorted by hardcoded volume rank
- USD is synthesized (rate: 1.0, change: 0%, rank: 1)

### Dashboard payload

Add `topCurrencies: DashboardCurrency[]` to `DashboardPayload` in `server/types.ts` and `src/types/dashboard.ts`.

Add to `assembleDashboard()` in `server/dashboard.ts`:
- Fetch currencies in parallel with existing crypto/stock/night calls
- Track in `segmentMeta` as `topCurrencies` segment
- Add to `degradedSegments` when fallback is used

### Fallback data

Add static currency data to `server/fallback/dashboard-fallback.json` with approximate rates as of spec date.

### Caching

Same pattern as stocks/cryptos — cached in memory (30s fresh, 10min stale) and durable cache (Upstash).

## Frontend Changes

### Types

Add `DashboardCurrency` to `src/types/dashboard.ts`.

### App.tsx

- Add `section-currencies` to `SECTION_IDS` (between `section-stocks` and `section-cryptos`)
- Add "Currencies" link to section nav
- Add `filteredCurrencies` memo with same filter/sort pattern as stocks
- New `renderCurrencyGrid()` using `MarketCard` in `assetStyle` mode:
  - `value`: formatted rate vs USD (e.g. "$1.08")
  - `valueLabel`: "Rate vs USD"
  - `secondary`: 24h change % (with trend color) or "Forex volume ranking" if no change data
  - Pin/watchlist support (same as stocks)
- Section placed between Stocks and Cryptos sections
- Section accent: `currencies-surface` with a teal/cyan border color

### globals.css

- Add `.currencies-surface` with teal border accent (`rgba(77, 240, 224, 0.32)` dark, `rgba(8, 145, 178, 0.28)` light)
- Add `[data-category="currency"]` pill styling (teal, matching the section accent)
- Add currency-specific card hover glow (teal palette)

### Logos

Use FMP's flag/logo endpoint if available, with country flag emoji as LogoMark fallback text. Map each currency symbol to a 2-letter country code for flag resolution.

## Error Handling

- If FMP forex endpoint fails: currencies section shows with fallback data (same degraded indicator pattern)
- If a specific pair is missing from the response: that currency still appears with `rateVsUsd: null`, showing "—" for rate

## Testing

- Unit test for `fetchTopCurrencies()` with mocked FMP responses
- Test pair normalization (XXXUSD vs USDXXX inversion)
- Test USD synthesis (always rank 1, rate 1.0)
- Test fallback behavior when forex endpoint fails
- Frontend: existing App.test.tsx patterns extended for currency section

## Scope Boundaries

- No currency converter feature
- No historical chart/sparkline (no free 7-day forex history from FMP)
- No compare mode for currencies (only cryptos have compare)
- Hardcoded top 10 ranking (not dynamically computed from volume data)

import { expect, test } from "@playwright/test";

test("dashboard smoke renders cards, symbols, logos, and status", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Global Assets Dashboard/i })).toBeVisible();
  await expect(page.getByLabel("Search markets")).toBeVisible();
  await expect(page.getByLabel("Sort markets")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Global Assets" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Cryptocurrencies" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Stocks" })).toBeVisible();

  const cards = page.locator(".coin-card");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const pills = page.locator(".symbol-pill");
  await expect(pills.first()).toBeVisible({ timeout: 15_000 });
  expect(await pills.count()).toBeGreaterThan(0);

  const logos = page.locator(".asset-logo, .logo-fallback");
  expect(await logos.count()).toBeGreaterThan(0);

  const freshness = page.locator(".freshness-badge");
  await expect(freshness.first()).toBeVisible();
  expect(await freshness.count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Pin .* to watchlist/ }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: "Pinned Watchlist" })).toBeVisible();

  await cards.first().hover();
});

test("shows stale/degraded status when providers are unavailable", async ({ page }) => {
  await page.goto("/");

  const degraded = page.locator(".freshness-badge--degraded");
  await expect(degraded.first()).toBeVisible({ timeout: 15_000 });
  await expect(degraded.first()).toContainText("Fallback");
});

test("renders logo fallback marks when logo network requests fail", async ({ page }) => {
  await page.route(/\.(png|jpg|jpeg|webp|avif|svg)(\?.*)?$/i, async (route) => {
    await route.abort();
  });

  await page.goto("/");

  const fallbackMarks = page.locator(".logo-fallback");
  await expect(fallbackMarks.first()).toBeVisible({ timeout: 15_000 });
  expect(await fallbackMarks.count()).toBeGreaterThan(0);
});

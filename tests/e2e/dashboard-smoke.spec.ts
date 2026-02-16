import { expect, test } from "@playwright/test";

test("dashboard smoke renders cards, symbols, logos, and status", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Crypto & Global Assets/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Cryptos" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Stocks" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Top 10 Assets" })).toBeVisible();

  const cards = page.locator(".coin-card");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const logos = page.locator(".asset-logo, .logo-fallback");
  expect(await logos.count()).toBeGreaterThan(0);

  const pills = page.locator(".symbol-pill");
  expect(await pills.count()).toBeGreaterThan(0);

  const status = page.locator(".status");
  await expect(status).toBeVisible();

  const before = await status.textContent();
  await cards.first().hover();
  await page.waitForTimeout(1_150);
  const after = await status.textContent();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after).not.toEqual(before);
});

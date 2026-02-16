import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      FMP_BASE_URL: "http://127.0.0.1:9",
      COINPAPRIKA_BASE_URL: "http://127.0.0.1:9",
      FMP_API_KEY: "local-test",
      CACHE_TTL_SEC: "60",
      FALLBACK_TTL_SEC: "600",
    },
  },
});

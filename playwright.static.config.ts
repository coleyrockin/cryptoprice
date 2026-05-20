import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /static-pages\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4191/world-asset-prices",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build:pages && GITHUB_PAGES=true vite preview --config vite.config.ts --host 127.0.0.1 --port 4191",
    url: "http://127.0.0.1:4191/world-asset-prices/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

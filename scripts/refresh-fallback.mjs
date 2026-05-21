#!/usr/bin/env node
// Snapshot the live dashboard payload into server/fallback/dashboard-fallback.json
// so the bundled fallback stays fresh even when providers fail from Vercel egress IPs.
//
// Runs from CI (GitHub Actions egress IPs), where Stooq + Yahoo are reachable.
// Aborts without writing if the live response is itself degraded — never overwrite
// a known-good fallback with stale data.

import { writeFile } from "node:fs/promises";

const ENDPOINT = process.env.WAP_DASHBOARD_URL ?? "https://world-asset-prices.vercel.app/api/dashboard";
const OUTPUT = new URL("../server/fallback/dashboard-fallback.json", import.meta.url);

async function main() {
  const response = await fetch(ENDPOINT, {
    headers: { "User-Agent": "wap-refresh-fallback/1.0" },
  });
  if (!response.ok) {
    throw new Error(`dashboard endpoint returned ${response.status}`);
  }
  const payload = await response.json();

  if (payload.source?.fallbackUsed === true) {
    console.error("Refusing to refresh: live dashboard is itself on fallback.", {
      degradedSegments: payload.degradedSegments,
      segmentMeta: payload.segmentMeta,
    });
    process.exit(1);
  }

  const degraded = Array.isArray(payload.degradedSegments) ? payload.degradedSegments : [];
  if (degraded.length > 0) {
    console.error("Refusing to refresh: degraded segments present.", degraded);
    process.exit(1);
  }

  if (!Array.isArray(payload.topStocks) || payload.topStocks.length === 0) {
    throw new Error("payload missing topStocks");
  }
  if (!Array.isArray(payload.topEtfs) || payload.topEtfs.length === 0) {
    throw new Error("payload missing topEtfs");
  }

  payload.generatedAt = new Date().toISOString();
  payload.stale = false;
  payload.source = {
    ...payload.source,
    fallbackUsed: false,
  };
  payload.degradedSegments = [];

  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("Refreshed fallback snapshot.", {
    generatedAt: payload.generatedAt,
    stocks: payload.topStocks.length,
    etfs: payload.topEtfs.length,
  });
}

main().catch((error) => {
  console.error("refresh-fallback failed:", error);
  process.exit(1);
});

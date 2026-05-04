import { afterEach, describe, expect, it } from "vitest";

import { buildHealthPayload } from "./health";
import { recordDashboardError, recordDashboardRequest, recordFallbackServe, recordProviderFailure, resetMetrics } from "./metrics";

describe("buildHealthPayload", () => {
  afterEach(() => {
    resetMetrics();
  });

  it("reports ready by default", () => {
    const health = buildHealthPayload("req-1");
    expect(health.readiness).toBe("ready");
    expect(health.checks.providers).toBe("ok");
    expect(health).not.toHaveProperty("metrics");
    expect(health).not.toHaveProperty("providerStatus");
  });

  it("reports degraded when provider failures/fallback are observed", () => {
    recordProviderFailure("topCryptos");
    recordFallbackServe();

    const health = buildHealthPayload("req-2");
    expect(health.readiness).toBe("degraded");
    expect(health.checks.providers).toBe("degraded");
    expect(health.checks.fallback).toBe("in-use");
  });

  it("reports down when all dashboard requests fail", () => {
    recordDashboardRequest();
    recordDashboardError();

    const health = buildHealthPayload("req-3");
    expect(health.readiness).toBe("down");
    expect(health.ok).toBe(false);
  });
});

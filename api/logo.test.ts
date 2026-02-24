/* eslint-disable import/order */
/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "../server/rate-limit";
import handler from "./logo";
import { createMockResponse } from "./test-utils";

describe("GET /api/logo", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetRateLimits();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects invalid logo URL", async () => {
    const { response, state } = createMockResponse();

    await handler({ method: "GET", query: { url: "javascript:alert(1)" } }, response);

    expect(state.statusCode).toBe(400);
    expect((state.jsonBody as { reason?: string }).reason).toBeTruthy();
  });

  it("rejects unallowed host", async () => {
    const { response, state } = createMockResponse();

    await handler({ method: "GET", query: { url: "https://example.com/logo.png" } }, response);

    expect(state.statusCode).toBe(400);
    expect((state.jsonBody as { reason?: string }).reason).toBe("host_not_allowed");
  });

  it("rejects oversized payloads", async () => {
    process.env.LOGO_PROXY_MAX_BYTES = "100";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(Buffer.alloc(15_000), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "15000",
          },
        }),
      ),
    );

    const { response, state } = createMockResponse();
    await handler(
      {
        method: "GET",
        query: { url: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png" },
      },
      response,
    );

    expect(state.statusCode).toBe(413);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    process.env.LOGO_PROXY_RATE_LIMIT_PER_MIN = "1";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(Buffer.alloc(50), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "50",
          },
        }),
      ),
    );

    const request = {
      method: "GET",
      query: { url: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png" },
      headers: {
        "x-forwarded-for": "198.51.100.10",
      },
    };

    const responses = Array.from({ length: 6 }, () => createMockResponse());
    for (const item of responses) {
      await handler(request, item.response);
    }

    expect(responses[0].state.statusCode).toBe(200);
    expect(responses[5].state.statusCode).toBe(429);
  });
});

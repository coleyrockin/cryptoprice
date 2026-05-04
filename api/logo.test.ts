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

  it("does not let spoofed forwarding headers bypass local rate limits", async () => {
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

    const responses = Array.from({ length: 6 }, () => createMockResponse());
    for (let index = 0; index < responses.length; index += 1) {
      await handler(
        {
          method: "GET",
          query: { url: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png" },
          headers: {
            "x-forwarded-for": `198.51.100.${10 + index}`,
          },
          socket: { remoteAddress: "192.0.2.44" },
        },
        responses[index].response,
      );
    }

    expect(responses[0].state.statusCode).toBe(200);
    expect(responses[5].state.statusCode).toBe(429);
  });

  it("does not follow upstream logo redirects", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: "http://169.254.169.254/latest/meta-data/",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { response } = createMockResponse();
    await handler(
      {
        method: "GET",
        query: { url: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png" },
      },
      response,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("redacts logo upstream query strings before logging fetch failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("upstream failed");
      }),
    );

    const { response, state } = createMockResponse();
    await handler(
      {
        method: "GET",
        query: { url: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png?token=secret#fragment" },
      },
      response,
    );

    expect(state.statusCode).toBe(502);
    const logLine = errorSpy.mock.calls[0]?.[0];
    expect(typeof logLine).toBe("string");
    const logged = JSON.parse(logLine as string) as { upstream?: string };
    expect(logged.upstream).toBe("https://static.coinpaprika.com/coin/btc-bitcoin/logo.png");
    expect(logLine).not.toContain("token=secret");
    expect(logLine).not.toContain("fragment");
  });
});

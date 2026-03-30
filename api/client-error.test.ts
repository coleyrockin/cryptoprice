/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimits } from "../server/rate-limit";
import handler from "./client-error";
import { createMockResponse } from "./test-utils";

describe("POST /api/client-error", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetRateLimits();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 400 for invalid payload schema", () => {
    const { response, state } = createMockResponse();

    handler(
      {
        method: "POST",
        body: {
          source: "window-error",
        },
      },
      response,
    );

    expect(state.statusCode).toBe(400);
  });

  it("returns 202 for valid payload", () => {
    const { response, state } = createMockResponse();

    handler(
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.20",
        },
        body: {
          source: "window-error",
          message: "something broke",
          stack: "trace",
          url: "https://example.com/app",
          userAgent: "test",
          timestamp: "2026-02-24T00:00:00.000Z",
        },
      },
      response,
    );

    expect(state.statusCode).toBe(202);
    expect((state.jsonBody as { ok?: boolean }).ok).toBe(true);
  });

  it("returns 413 for oversized content length", () => {
    process.env.CLIENT_ERROR_MAX_BYTES = "16";

    const { response, state } = createMockResponse();

    handler(
      {
        method: "POST",
        headers: {
          "content-length": "4096",
        },
        body: {
          message: "x",
        },
      },
      response,
    );

    expect(state.statusCode).toBe(413);
  });

  it("returns 429 when rate limited", () => {
    process.env.CLIENT_ERROR_RATE_LIMIT_PER_MIN = "1";

    const request = {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.21",
      },
      body: {
        source: "window-error",
        message: "something broke",
      },
    };

    const responses = Array.from({ length: 6 }, () => createMockResponse());
    for (const item of responses) {
      handler(request, item.response);
    }

    expect(responses[0].state.statusCode).toBe(202);
    expect(responses[5].state.statusCode).toBe(429);
  });
});

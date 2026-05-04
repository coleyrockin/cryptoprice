import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJsonWithRetry } from "./request";

describe("requestJsonWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects JSON responses that exceed the configured byte limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ payload: "x".repeat(128) }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": "256",
          },
        }),
      ),
    );

    await expect(requestJsonWithRetry("https://api.example.test/data", { maxBytes: 32, retries: 0 })).rejects.toThrow(
      "payload_too_large",
    );
  });
});

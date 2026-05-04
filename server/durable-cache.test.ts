import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readDurableDashboard } from "./durable-cache";

describe("readDurableDashboard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: "https://redis.example.test",
      KV_REST_API_TOKEN: "token",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("rejects durable cache records without a valid dashboard payload shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: JSON.stringify({
              updatedAt: new Date().toISOString(),
              payload: {
                generatedAt: new Date().toISOString(),
                topStocks: "not-an-array",
              },
            }),
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(readDurableDashboard(600)).resolves.toBeNull();
  });
});

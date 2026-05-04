import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardFallbackPayload } from "./dashboard";
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

  it("rejects durable cache records with invalid entry fields inside arrays", async () => {
    const payload = structuredClone(dashboardFallbackPayload);
    payload.topStocks = [
      {
        ...payload.topStocks[0],
        id: 123 as unknown as string,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          result: JSON.stringify({
            updatedAt: new Date().toISOString(),
            payload,
          }),
        }),
      ),
    );

    await expect(readDurableDashboard(600)).resolves.toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { getClientKey } from "./client-key";

describe("getClientKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not trust request-supplied Vercel headers outside a trusted proxy environment", () => {
    process.env = { ...originalEnv };
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_HEADERS;

    expect(
      getClientKey({
        headers: {
          "x-vercel-id": "cle1::spoofed",
          "x-forwarded-for": "198.51.100.9",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("192.0.2.44");
  });

  it("trusts forwarding headers only when enabled by server-side environment", () => {
    process.env = { ...originalEnv, TRUST_PROXY_HEADERS: "true" };

    expect(
      getClientKey({
        headers: {
          "x-forwarded-for": "198.51.100.9",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("198.51.100.9");
  });
});

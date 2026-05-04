import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel security headers", () => {
  it("keeps image CSP limited to same-origin and data images", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      headers: Array<{ headers: Array<{ key: string; value: string }> }>;
    };

    const csp = config.headers[0]?.headers.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("img-src 'self' data:");
    expect(csp).not.toMatch(/img-src[^;]*https:/);
  });
});

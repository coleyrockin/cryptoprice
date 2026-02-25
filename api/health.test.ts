/* eslint-disable import/order */
import { describe, expect, it, vi } from "vitest";

vi.mock("../server/health", () => ({
  buildHealthPayload: vi.fn(() => ({
    ok: true,
    readiness: "ready",
    requestId: "req-1",
    service: "wap-api",
  })),
}));

import handler from "./health";
import { createMockResponse } from "./test-utils";
import { buildHealthPayload } from "../server/health";

const mockedBuildHealthPayload = vi.mocked(buildHealthPayload);

describe("GET /api/health", () => {
  it("returns 405 for invalid method", () => {
    const { response, state } = createMockResponse();

    handler({ method: "POST" }, response);

    expect(state.statusCode).toBe(405);
    expect(state.headers["allow"]).toBe("GET");
  });

  it("returns readiness payload and request id header", () => {
    const { response, state } = createMockResponse();

    handler({ method: "GET" }, response);

    expect(state.statusCode).toBe(200);
    expect(mockedBuildHealthPayload).toHaveBeenCalledTimes(1);
    expect(state.headers["x-wap-request-id"]).toBeTruthy();

    const body = state.jsonBody as { readiness: string };
    expect(body.readiness).toBe("ready");
  });
});

import { createHash } from "node:crypto";

import { envInt } from "../server/env.js";
import { getClientKey, getRequestHeader } from "../server/client-key.js";
import { createRequestId, logEvent } from "../server/log.js";
import { recordClientError } from "../server/metrics.js";
import { rateLimit } from "../server/rate-limit.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

type NormalizedClientError = {
  message: string;
  source: string;
  stackHash: string | null;
  url: string | null;
  userAgent: string | null;
  timestamp: string;
};

function getContentLength(request: ApiRequest): number | null {
  const raw = getRequestHeader(request, "content-length");
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof body === "object" && body) {
    return body as Record<string, unknown>;
  }

  return null;
}

function toTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function sanitizeClientUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("#")[0]?.split("?")[0]?.slice(0, 2_000) ?? null;
  }
}

function hashStack(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizeClientError(payload: Record<string, unknown>): NormalizedClientError | null {
  const message = toTrimmedString(payload.message, 400);
  if (!message) {
    return null;
  }

  const source = toTrimmedString(payload.source, 80) ?? "unknown";
  const stackHash = hashStack(toTrimmedString(payload.stack, 6_000));
  const url = sanitizeClientUrl(toTrimmedString(payload.url, 2_000));
  const userAgent = toTrimmedString(payload.userAgent, 300);

  const timestampRaw = toTrimmedString(payload.timestamp, 80);
  const parsedTimestamp = timestampRaw ? Date.parse(timestampRaw) : Number.NaN;

  return {
    message,
    source,
    stackHash,
    url,
    userAgent,
    timestamp: Number.isFinite(parsedTimestamp) ? new Date(parsedTimestamp).toISOString() : new Date().toISOString(),
  };
}

export default function handler(request: ApiRequest, response: ApiResponse): void {
  const requestId = createRequestId();

  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(405).json({ error: "Method Not Allowed", requestId });
    return;
  }

  const maxBytes = envInt("CLIENT_ERROR_MAX_BYTES", 8_192, 512, 65_536);
  const contentLength = getContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(413).json({ error: "Payload too large", requestId });
    return;
  }

  const clientKey = getClientKey(request);
  const rateLimitResult = rateLimit("client-error", clientKey, {
    limit: envInt("CLIENT_ERROR_RATE_LIMIT_PER_MIN", 30, 5, 180),
    windowSec: 60,
  });

  if (!rateLimitResult.allowed) {
    response.setHeader("Retry-After", String(rateLimitResult.retryAfterSec));
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(429).json({ error: "Rate limit exceeded", requestId });
    return;
  }

  const parsedBody = parseBody(request.body);
  if (!parsedBody) {
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(400).json({ error: "Invalid payload", requestId });
    return;
  }

  const normalized = normalizeClientError(parsedBody);
  if (!normalized) {
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(400).json({ error: "Invalid payload schema", requestId });
    return;
  }

  recordClientError();
  logEvent("warn", "api.client-error.received", {
    requestId,
    clientKey,
    payload: normalized,
  });

  response.setHeader("X-Wap-Request-Id", requestId);
  response.status(202).json({ ok: true, requestId });
}

import { envInt } from "../server/env";
import { createRequestId, logError, logEvent } from "../server/log";
import { recordLogoProxyError, recordLogoProxyRequest } from "../server/metrics";
import { rateLimit } from "../server/rate-limit";
import { parseAndValidateLogoUrl } from "../server/security";

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  send: (value: Buffer | string) => void;
  json: (value: unknown) => void;
};

function getHeader(request: ApiRequest, key: string): string | null {
  const value = request.headers?.[key.toLowerCase()] ?? request.headers?.[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

const IP_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]{2,39}$/;

function getClientKey(request: ApiRequest): string {
  const forwarded = getHeader(request, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && IP_PATTERN.test(first)) {
      return first;
    }
  }

  return request.socket?.remoteAddress ?? "unknown";
}

function getUrlParam(request: ApiRequest): string | null {
  const queryValue = request.query?.url;

  if (typeof queryValue === "string") {
    return queryValue;
  }

  if (Array.isArray(queryValue) && typeof queryValue[0] === "string") {
    return queryValue[0];
  }

  if (typeof request.url === "string") {
    const parsed = new URL(request.url, "http://localhost");
    return parsed.searchParams.get("url");
  }

  return null;
}

async function readResponseBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error("payload_too_large");
    }

    return fallback;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = Buffer.from(value);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error("payload_too_large");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const requestId = createRequestId();

  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(405).json({ error: "Method Not Allowed", requestId });
    return;
  }

  recordLogoProxyRequest();

  const clientKey = getClientKey(request);
  const rateLimitResult = rateLimit("logo", clientKey, {
    limit: envInt("LOGO_PROXY_RATE_LIMIT_PER_MIN", 60, 5, 240),
    windowSec: 60,
  });

  if (!rateLimitResult.allowed) {
    recordLogoProxyError();
    response.setHeader("Retry-After", String(rateLimitResult.retryAfterSec));
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(429).json({ error: "Rate limit exceeded", requestId });
    return;
  }

  const { url: logoUrl, reason } = parseAndValidateLogoUrl(getUrlParam(request));
  if (!logoUrl) {
    recordLogoProxyError();
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(400).json({ error: "Invalid logo URL", reason, requestId });
    return;
  }

  const controller = new AbortController();
  const timeoutMs = envInt("LOGO_PROXY_TIMEOUT_MS", 5_000, 1_000, 15_000);
  const maxBytes = envInt("LOGO_PROXY_MAX_BYTES", 512_000, 10_000, 2_000_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(logoUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      recordLogoProxyError();
      response.setHeader("X-Wap-Request-Id", requestId);
      response.status(404).json({ error: "Logo not found", requestId });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      recordLogoProxyError();
      response.setHeader("X-Wap-Request-Id", requestId);
      response.status(415).json({ error: "Unsupported logo response", requestId });
      return;
    }

    const contentLength = Number.parseInt(upstream.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      recordLogoProxyError();
      response.setHeader("X-Wap-Request-Id", requestId);
      response.status(413).json({ error: "Logo payload too large", requestId });
      return;
    }

    const body = await readResponseBodyWithLimit(upstream, maxBytes);

    response.setHeader("X-Wap-Request-Id", requestId);
    response.setHeader("Content-Type", contentType);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    response.status(200).send(body);
  } catch (error) {
    recordLogoProxyError();

    if (error instanceof Error && error.message === "payload_too_large") {
      response.setHeader("X-Wap-Request-Id", requestId);
      response.status(413).json({ error: "Logo payload too large", requestId });
      return;
    }

    logError("api.logo.failed", error, {
      requestId,
      upstream: logoUrl.toString(),
    });

    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(502).json({ error: "Logo fetch failed", requestId });
  } finally {
    clearTimeout(timeout);
    logEvent("info", "api.logo.complete", {
      requestId,
      host: logoUrl.hostname,
      clientKey,
    });
  }
}

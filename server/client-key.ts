import { isIP } from "node:net";

type HeaderValue = string | string[] | undefined;

export type ClientKeyRequest = {
  headers?: Record<string, HeaderValue>;
  socket?: {
    remoteAddress?: string;
  };
};

export function getRequestHeader(request: ClientKeyRequest, key: string): string | null {
  const value = request.headers?.[key.toLowerCase()] ?? request.headers?.[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function normalizeIp(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim();
  if (!candidate || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}

function shouldTrustProxyHeaders(request: ClientKeyRequest): boolean {
  return process.env.VERCEL === "1" || getRequestHeader(request, "x-vercel-id") !== null;
}

export function getClientKey(request: ClientKeyRequest): string {
  if (shouldTrustProxyHeaders(request)) {
    const forwarded =
      normalizeIp(getRequestHeader(request, "x-vercel-forwarded-for")) ??
      normalizeIp(getRequestHeader(request, "x-forwarded-for")) ??
      normalizeIp(getRequestHeader(request, "x-real-ip"));

    if (forwarded) {
      return forwarded;
    }
  }

  return normalizeIp(request.socket?.remoteAddress ?? null) ?? "unknown";
}

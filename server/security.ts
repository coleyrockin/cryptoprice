const DEFAULT_ALLOWED_LOGO_HOSTS = [
  "static.coinpaprika.com",
  "cryptoicons.org",
  "cryptoicon-api.pages.dev",
  "financialmodelingprep.com",
  "cdnjs.cloudflare.com",
];

function isIpv4Private(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  return false;
}

function isIpv6Private(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized.endsWith(".local")) {
    return true;
  }

  if (isIpv4Private(normalized) || isIpv6Private(normalized)) {
    return true;
  }

  return false;
}

function getAllowedLogoHosts(): string[] {
  const raw = process.env.LOGO_ALLOWED_HOSTS;
  if (!raw) {
    return DEFAULT_ALLOWED_LOGO_HOSTS;
  }

  const hosts = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return hosts.length > 0 ? hosts : DEFAULT_ALLOWED_LOGO_HOSTS;
}

export function isAllowedLogoHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || isPrivateHost(normalized)) {
    return false;
  }

  return getAllowedLogoHosts().some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

export function parseAndValidateLogoUrl(value: string | null): { url: URL | null; reason: string | null } {
  if (!value) {
    return { url: null, reason: "missing_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { url: null, reason: "invalid_url" };
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return { url: null, reason: "invalid_protocol" };
  }

  if (!isAllowedLogoHost(parsed.hostname)) {
    return { url: null, reason: "host_not_allowed" };
  }

  return { url: parsed, reason: null };
}

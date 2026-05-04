export function resolveProviderBaseUrl(
  value: string | undefined,
  fallback: string,
  providerName: string,
  allowedHostname: string,
): string {
  let parsed: URL;
  try {
    parsed = new URL(value ?? fallback);
  } catch {
    throw new Error(`Invalid ${providerName} base URL`);
  }

  const hasPath = parsed.pathname !== "" && parsed.pathname !== "/";
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== allowedHostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    hasPath
  ) {
    throw new Error(`Invalid ${providerName} base URL`);
  }

  return parsed.origin;
}

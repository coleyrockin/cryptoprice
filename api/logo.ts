import { recordLogoProxyError, recordLogoProxyRequest } from "../server/metrics";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  send: (value: Buffer | string) => void;
  json: (value: unknown) => void;
};

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

function sanitizeLogoUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  recordLogoProxyRequest();

  const safeUrl = sanitizeLogoUrl(getUrlParam(request));
  if (!safeUrl) {
    response.status(400).json({ error: "Invalid logo URL" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const upstream = await fetch(safeUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      recordLogoProxyError();
      response.status(404).json({ error: "Logo not found" });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      recordLogoProxyError();
      response.status(415).json({ error: "Unsupported logo response" });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    response.status(200).send(body);
  } catch {
    recordLogoProxyError();
    response.status(502).json({ error: "Logo fetch failed" });
  } finally {
    clearTimeout(timeout);
  }
}

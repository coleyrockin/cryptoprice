export type RequestJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: HeadersInit;
  maxBytes?: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestJsonWithRetry<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = Math.max(0, Math.min(3, options.retries ?? 1));
  const maxBytes = Math.max(1, Math.min(5_000_000, options.maxBytes ?? 1_000_000));

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return JSON.parse(await readResponseTextWithLimit(response, maxBytes)) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const baseMs = 180 * (attempt + 1);
        const jitterMs = Math.floor(Math.random() * baseMs * 0.5);
        await wait(baseMs + jitterMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("payload_too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error("payload_too_large");
    }

    return fallback.toString("utf8");
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

  return Buffer.concat(chunks).toString("utf8");
}

import { isDurableCacheConfigured } from "../server/durable-cache";
import { getMetricsSnapshot } from "../server/metrics";

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  response.status(200).json({
    ok: true,
    service: "cryptoprice-api",
    timestamp: new Date().toISOString(),
    durableCache: {
      configured: isDurableCacheConfigured(),
    },
    metrics: getMetricsSnapshot(),
  });
}

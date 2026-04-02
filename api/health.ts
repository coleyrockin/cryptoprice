import { buildHealthPayload } from "../server/health.js";
import { createRequestId, logEvent } from "../server/log.js";

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

export default function handler(request: ApiRequest, response: ApiResponse): void {
  const requestId = createRequestId();
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("X-Wap-Request-Id", requestId);
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  logEvent("info", "api.health.request", { requestId });
  const payload = buildHealthPayload(requestId);

  response.setHeader("X-Wap-Request-Id", requestId);
  response.status(200).json(payload);
}

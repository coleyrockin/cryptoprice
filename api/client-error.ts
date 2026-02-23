import { recordClientError } from "../server/metrics";

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  recordClientError();

  const payload = typeof request.body === "object" && request.body ? request.body : null;
  const message = payload && "message" in payload ? String((payload as { message: unknown }).message) : "unknown client error";

  console.warn(`[client-error] ${message}`);

  response.status(202).json({ ok: true });
}

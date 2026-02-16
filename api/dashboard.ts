import { buildDashboardPayload } from "../server/dashboard";

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (value: unknown) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = await buildDashboardPayload();
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[dashboard] request failed reason=${message}`);
    response.status(502).json({
      error: "Failed to build dashboard payload",
    });
  }
}

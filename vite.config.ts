import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { buildDashboardPayload } from "./server/dashboard";
import { buildHealthPayload } from "./server/health";
import { createRequestId } from "./server/log";

function localApiPlugin(): Plugin {
  return {
    name: "local-api-plugin",
    configureServer(server) {
      const localApiHandler = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const parsedUrl = new URL(request.url ?? "/", "http://localhost");
        const url = parsedUrl.pathname;
        if (!url) {
          next();
          return;
        }

        if (url === "/__local_api/health" && request.method === "GET") {
          const requestId = createRequestId();
          response.setHeader("Content-Type", "application/json");
          response.statusCode = 200;
          response.end(JSON.stringify(buildHealthPayload(requestId)));
          return;
        }

        if (url === "/__local_api/dashboard" && request.method === "GET") {
          const requestId = createRequestId();
          try {
            const payload = await buildDashboardPayload();
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 200;
            response.end(JSON.stringify({ ...payload, requestId }));
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 502;
            response.end(JSON.stringify({ error: "Failed to build dashboard payload", reason: message, requestId }));
          }
          return;
        }

        if (url === "/__local_api/client-error" && request.method === "POST") {
          response.setHeader("Content-Type", "application/json");
          response.statusCode = 202;
          response.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      };

      server.middlewares.use(localApiHandler);
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/cryptoprice/" : "/",
  plugins: [react(), localApiPlugin()],
  server: {
    host: "localhost",
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: 5189,
    strictPort: true,
  },
});

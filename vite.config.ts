import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { buildDashboardPayload } from "./server/dashboard";

function localApiPlugin(): Plugin {
  return {
    name: "local-api-plugin",
    configureServer(server) {
      const localApiHandler = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        const url = request.url?.split("?")[0];
        if (request.method !== "GET" || !url) {
          next();
          return;
        }

        if (url === "/__local_api/health") {
          response.setHeader("Content-Type", "application/json");
          response.statusCode = 200;
          response.end(
            JSON.stringify({
              ok: true,
              service: "cryptoprice-api-local",
              timestamp: new Date().toISOString(),
            }),
          );
          return;
        }

        if (url === "/__local_api/dashboard") {
          try {
            const payload = await buildDashboardPayload();
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 200;
            response.end(JSON.stringify(payload));
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            response.setHeader("Content-Type", "application/json");
            response.statusCode = 502;
            response.end(JSON.stringify({ error: "Failed to build dashboard payload", reason: message }));
          }
          return;
        }

        next();
      };

      server.middlewares.use(localApiHandler);
    },
  };
}

export default defineConfig({
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

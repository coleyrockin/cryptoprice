import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
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

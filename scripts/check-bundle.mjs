import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distAssets = join(process.cwd(), "dist", "assets");

// Per-file ceiling (any single JS chunk) and total-payload ceiling (all JS
// chunks combined). Both are raw bytes; override via env in CI if needed.
const maxJsBytes = Number.parseInt(process.env.MAX_BUNDLE_JS_BYTES ?? "420000", 10);
const maxTotalJsBytes = Number.parseInt(process.env.MAX_BUNDLE_TOTAL_JS_BYTES ?? "520000", 10);

const files = readdirSync(distAssets);
const jsFiles = files.filter((file) => file.endsWith(".js"));

if (jsFiles.length === 0) {
  throw new Error("No *.js bundles found in dist/assets");
}

const sizes = jsFiles
  .map((file) => ({ file, size: statSync(join(distAssets, file)).size }))
  .sort((a, b) => b.size - a.size);
const totalBytes = sizes.reduce((sum, item) => sum + item.size, 0);

const violations = sizes.filter((item) => item.size > maxJsBytes);
if (violations.length > 0) {
  const details = violations.map((item) => `${item.file}: ${item.size} bytes`).join(", ");
  throw new Error(`Per-file bundle limit exceeded (${maxJsBytes} bytes): ${details}`);
}

if (totalBytes > maxTotalJsBytes) {
  const breakdown = sizes.map((item) => `${item.file}=${item.size}`).join(", ");
  throw new Error(`Total JS payload ${totalBytes} bytes exceeds ${maxTotalJsBytes}: ${breakdown}`);
}

console.log(
  `Bundle check passed. files=${jsFiles.length} total=${totalBytes}B (limit ${maxTotalJsBytes}B), per-file limit ${maxJsBytes}B`,
);

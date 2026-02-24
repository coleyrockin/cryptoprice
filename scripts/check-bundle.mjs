/* global process, console */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distAssets = join(process.cwd(), "dist", "assets");
const maxJsBytes = Number.parseInt(process.env.MAX_BUNDLE_JS_BYTES ?? "420000", 10);

const files = readdirSync(distAssets);
const jsFiles = files.filter((file) => file.startsWith("index-") && file.endsWith(".js"));

if (jsFiles.length === 0) {
  throw new Error("No index-*.js bundle found in dist/assets");
}

const violations = [];
for (const file of jsFiles) {
  const filePath = join(distAssets, file);
  const size = statSync(filePath).size;
  if (size > maxJsBytes) {
    violations.push({ file, size });
  }
}

if (violations.length > 0) {
  const details = violations.map((item) => `${item.file}: ${item.size} bytes`).join(", ");
  throw new Error(`Bundle size limit exceeded (${maxJsBytes} bytes): ${details}`);
}

console.log(`Bundle check passed. limit=${maxJsBytes} bytes files=${jsFiles.length}`);

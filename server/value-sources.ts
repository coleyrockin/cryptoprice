import assetValueSourcesJson from "./data/asset-value-sources.json" with { type: "json" };

import type { AssetValueSource } from "./types.js";

type AssetValueSourceManifest = {
  version: string;
  generatedAt: string;
  sources: AssetValueSource[];
};

const manifest = assetValueSourcesJson as AssetValueSourceManifest;
const sourcesById = new Map(manifest.sources.map((source) => [source.assetId, source]));

export const ASSET_VALUE_SOURCE_VERSION = manifest.version;
export const ASSET_VALUE_SOURCES = manifest.sources;

export function getAssetValueSource(assetId: string): AssetValueSource | undefined {
  return sourcesById.get(assetId);
}

export function assetValueSourcesById(): Record<string, AssetValueSource> {
  return Object.fromEntries(sourcesById);
}

export function sourceValueUsd(assetId: string): number | null {
  const value = sourcesById.get(assetId)?.valueUsd;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

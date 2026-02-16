export type CacheEntry<T> = {
  value: T;
  updatedAt: number;
};

export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, now = Date.now()): void {
    this.entries.set(key, { value, updatedAt: now });
  }

  getFresh<T>(key: string, ttlSec: number, now = Date.now()): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (now - entry.updatedAt > ttlSec * 1_000) {
      return null;
    }

    return entry.value as T;
  }

  getStale<T>(key: string, maxAgeSec: number, now = Date.now()): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (now - entry.updatedAt > maxAgeSec * 1_000) {
      return null;
    }

    return entry.value as T;
  }

  clear(): void {
    this.entries.clear();
  }
}

type GlobalCache = typeof globalThis & {
  __CRYPTOPRICE_RUNTIME_CACHE__?: MemoryCache;
};

const globalCache = globalThis as GlobalCache;

export const runtimeCache =
  globalCache.__CRYPTOPRICE_RUNTIME_CACHE__ ?? (globalCache.__CRYPTOPRICE_RUNTIME_CACHE__ = new MemoryCache());

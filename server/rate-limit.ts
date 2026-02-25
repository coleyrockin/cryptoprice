type RateLimitRecord = {
  count: number;
  resetAtMs: number;
};

type RateLimitState = {
  records: Map<string, RateLimitRecord>;
};

type GlobalRateLimit = typeof globalThis & {
  __WAP_RATE_LIMIT__?: RateLimitState;
};

const globalRateLimit = globalThis as GlobalRateLimit;

const state =
  globalRateLimit.__WAP_RATE_LIMIT__ ??
  (globalRateLimit.__WAP_RATE_LIMIT__ = {
    records: new Map<string, RateLimitRecord>(),
  });

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

function clearExpired(nowMs: number): void {
  for (const [key, value] of Array.from(state.records.entries())) {
    if (value.resetAtMs <= nowMs) {
      state.records.delete(key);
    }
  }
}

export function rateLimit(scope: string, clientKey: string, options: { limit: number; windowSec: number }, nowMs = Date.now()): RateLimitResult {
  const limit = Math.max(1, options.limit);
  const windowMs = Math.max(1_000, options.windowSec * 1_000);

  clearExpired(nowMs);

  const storeKey = `${scope}:${clientKey}`;
  const existing = state.records.get(storeKey);
  if (!existing) {
    state.records.set(storeKey, {
      count: 1,
      resetAtMs: nowMs + windowMs,
    });

    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSec: Math.ceil(windowMs / 1_000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1_000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1_000)),
  };
}

export function resetRateLimits(): void {
  state.records.clear();
}

import { useSyncExternalStore } from "react";

/**
 * A single shared 1-second clock for the whole app.
 *
 * Every relative-time display ("Updated 5s ago", freshness "· 12s ago") used to
 * run its own `setInterval`, so a fully-loaded dashboard had 7+ independent
 * timers each triggering a React re-render every second. This module-level
 * external store ticks ONE interval, lazily started on the first subscriber and
 * cleared when the last one unmounts. Consumers re-render in lockstep; nothing
 * else in the tree ticks.
 *
 * Implemented as an external store (not React context) so `useNow()` works with
 * no provider — important for unit tests that mount components in isolation.
 */

let currentMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  currentMs = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId === null && typeof window !== "undefined") {
    // Re-sync immediately so a freshly mounted consumer isn't up to ~1s stale.
    currentMs = Date.now();
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return currentMs;
}

/** Current epoch milliseconds, updated once per second across all consumers. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

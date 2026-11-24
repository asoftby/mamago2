"use client";

import { useSyncExternalStore } from "react";
import { formatBoostCountdownHms, getBoostRemainingMs } from "./boostCountdown";

const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId === null) {
    intervalId = setInterval(() => {
      for (const notify of listeners) notify();
    }, 1_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// Stable second snapshots; SSR/hydration starts without a guessed timestamp.
function getSnapshot(): number | null { return Math.floor(Date.now() / 1000); }
function getServerSnapshot(): null { return null; }

/** Client-only presentation clock; no polling, entitlement checks remain on server. */
export function useBoostCountdown(endsAt: Date | string | null | undefined): {
  remainingMs: number | null;
  label: string | null;
} {
  const second = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const remainingMs = second === null ? null : getBoostRemainingMs(endsAt, second * 1000);
  return {
    remainingMs,
    label: remainingMs === null ? null : formatBoostCountdownHms(remainingMs),
  };
}

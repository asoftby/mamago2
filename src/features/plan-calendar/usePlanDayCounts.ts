"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateKey } from "@/lib/date/dateKey";
import type { PlanScopeFilter } from "@/features/my-plan/lib/planVisibilityView";
import { chunkEnd, chunkStartsFor } from "./lib/dayChunks";

export type PlanDayMarkers = Record<DateKey, string[]>;

type Entry = { markers: PlanDayMarkers; stale: boolean };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Call after a plan entry was added/changed/removed: cached ranges refetch in the background. */
export function invalidatePlanDayMarkers(): void {
  for (const entry of cache.values()) entry.stale = true;
  notify();
}

function cacheKey(scope: PlanScopeFilter, start: DateKey): string {
  return scope + ":" + start;
}

function loadChunk(start: DateKey, scope: PlanScopeFilter): Promise<void> {
  const key = cacheKey(scope, start);
  const running = inflight.get(key);
  if (running) return running;
  const to = chunkEnd(start);
  const request = fetch(`/api/plan/day-markers?from=${start}&to=${to}&scope=${scope}`, { credentials: "include" })
    .then(async (res) => {
      const body = res.ok ? ((await res.json()) as { markers?: PlanDayMarkers }) : null;
      // A failed chunk is cached as fresh-empty (no retry loop); invalidate retries it.
      cache.set(key, { markers: body?.markers ?? {}, stale: false });
    })
    .catch(() => {
      cache.set(key, { markers: {}, stale: false });
    })
    .finally(() => {
      inflight.delete(key);
      notify();
    });
  inflight.set(key, request);
  return request;
}

/** Day → distinct owners ("family" | childId) for the range; one request per missing 35-day chunk. */
export function usePlanDayCounts(
  range: { from: DateKey; to: DateKey } | null,
  options: { enabled?: boolean; scope?: PlanScopeFilter } = {},
): PlanDayMarkers {
  const enabled = options.enabled ?? true;
  const scope = options.scope ?? "all";
  const [tick, setTick] = useState(0);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !from || !to) return;
    for (const start of chunkStartsFor(from, to)) {
      const entry = cache.get(cacheKey(scope, start));
      if (!entry || entry.stale) void loadChunk(start, scope);
    }
  }, [enabled, from, to, scope, tick]);

  return useMemo(() => {
    const merged: PlanDayMarkers = {};
    if (!from || !to) return merged;
    for (const start of chunkStartsFor(from, to)) {
      Object.assign(merged, cache.get(cacheKey(scope, start))?.markers);
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick signals cache changes
  }, [from, to, scope, tick]);
}

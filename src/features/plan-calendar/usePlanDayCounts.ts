"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, diffDays, type DateKey } from "@/lib/date/dateKey";

export type PlanDayMarkers = Record<DateKey, string[]>;

// The endpoint caps a range at 42 days; fixed 35-day chunks (Monday-aligned) give cache hits across ranges.
const CHUNK_DAYS = 35;
const EPOCH: DateKey = "2020-01-06";

type Entry = { markers: PlanDayMarkers; stale: boolean };

const cache = new Map<DateKey, Entry>();
const inflight = new Map<DateKey, Promise<void>>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function chunkStart(key: DateKey): DateKey {
  return addDays(EPOCH, Math.floor(diffDays(EPOCH, key) / CHUNK_DAYS) * CHUNK_DAYS);
}

export function chunkStartsFor(from: DateKey, to: DateKey): DateKey[] {
  const starts: DateKey[] = [];
  for (let s = chunkStart(from); s <= to; s = addDays(s, CHUNK_DAYS)) starts.push(s);
  return starts;
}

/** Call after a plan entry was added/changed/removed: cached ranges refetch in the background. */
export function invalidatePlanDayMarkers(): void {
  for (const entry of cache.values()) entry.stale = true;
  notify();
}

function loadChunk(start: DateKey): Promise<void> {
  const running = inflight.get(start);
  if (running) return running;
  const to = addDays(start, CHUNK_DAYS - 1);
  const request = fetch(`/api/plan/day-markers?from=${start}&to=${to}`, { credentials: "include" })
    .then(async (res) => {
      const body = res.ok ? ((await res.json()) as { markers?: PlanDayMarkers }) : null;
      // A failed chunk is cached as fresh-empty (no retry loop); invalidate retries it.
      cache.set(start, { markers: body?.markers ?? {}, stale: false });
    })
    .catch(() => {
      cache.set(start, { markers: {}, stale: false });
    })
    .finally(() => {
      inflight.delete(start);
      notify();
    });
  inflight.set(start, request);
  return request;
}

/** Day → distinct owners ("family" | childId) for the range; one request per missing 35-day chunk. */
export function usePlanDayCounts(
  range: { from: DateKey; to: DateKey } | null,
  options: { enabled?: boolean } = {},
): PlanDayMarkers {
  const enabled = options.enabled ?? true;
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
      const entry = cache.get(start);
      if (!entry || entry.stale) void loadChunk(start);
    }
  }, [enabled, from, to, tick]);

  return useMemo(() => {
    const merged: PlanDayMarkers = {};
    if (!from || !to) return merged;
    for (const start of chunkStartsFor(from, to)) {
      Object.assign(merged, cache.get(start)?.markers);
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick signals cache changes
  }, [from, to, tick]);
}

"use client";

import { useEffect, useState } from "react";

/**
 * Whether the day-scenario screen is on for this environment (DAY_SCENARIO_ENGINE_ENABLED).
 * One tiny request per page session, answered without the database and cached by the browser
 * for five minutes; until it answers, and whenever it fails, the answer is "off", so the
 * widget behaves exactly as before.
 */
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/plan/day-scenario/config", { credentials: "same-origin" });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: unknown };
    return body.enabled === true;
  } catch {
    return false;
  }
}

export function useDayScenarioEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false);
  useEffect(() => {
    if (cached !== null) {
      setEnabled(cached);
      return;
    }
    let alive = true;
    inflight ??= fetchEnabled().then((value) => {
      cached = value;
      return value;
    });
    void inflight.then((value) => {
      if (alive) setEnabled(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

/** Test hook: forget the remembered answer. */
export function resetDayScenarioEnabledCache(): void {
  cached = null;
  inflight = null;
}

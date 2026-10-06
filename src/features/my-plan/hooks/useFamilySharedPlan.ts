"use client";

import { useEffect, useState } from "react";

let cached: Promise<boolean> | null = null;

function loadSharedPlan(): Promise<boolean> {
  cached ??= fetch("/api/plan/family-state")
    .then((res) => (res.ok ? res.json() : { sharedPlan: false }))
    .then((data: { sharedPlan?: boolean }) => data.sharedPlan === true)
    .catch(() => false);
  return cached;
}

/** True when the signed-in user shares a plan with another adult. Fetched once per page load. */
export function useFamilySharedPlan(enabled: boolean): boolean {
  const [shared, setShared] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadSharedPlan().then((value) => {
      if (active) setShared(value);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled && shared;
}

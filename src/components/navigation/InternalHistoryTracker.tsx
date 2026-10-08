"use client";

import { useLayoutEffect } from "react";
import { installInternalHistoryTracking } from "@/lib/navigation/internalHistory";

/**
 * Persistent root-level history tracker.
 *
 * It must mount above all route groups so internal client-side navigation is
 * marked before entering or leaving the public layout.
 */
export function InternalHistoryTracker() {
  useLayoutEffect(() => installInternalHistoryTracking(), []);
  return null;
}

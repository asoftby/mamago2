"use client";

import { useMemo } from "react";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { filterUpcomingSessions } from "@/lib/event/filterUpcomingSessions";

/**
 * SSR passes server-filtered sessions; after mount re-filter with client `now`
 * to avoid hydration mismatch when a session expires between render and hydration.
 */
export function useUpcomingSessions(serverSessions: EventPageSession[]): EventPageSession[] {
  return useMemo(
    () => filterUpcomingSessions(serverSessions, new Date()),
    [serverSessions],
  );
}

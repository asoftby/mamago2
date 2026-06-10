"use client";

import { useEffect, useState } from "react";
import type { EventPageSession } from "@/lib/event/eventPageTypes";
import { filterUpcomingSessions } from "@/lib/event/filterUpcomingSessions";

/**
 * SSR passes server-filtered sessions; after mount re-filter with client `now`
 * to avoid hydration mismatch when a session expires between render and hydration.
 */
export function useUpcomingSessions(serverSessions: EventPageSession[]): EventPageSession[] {
  const [sessions, setSessions] = useState(serverSessions);

  useEffect(() => {
    setSessions(filterUpcomingSessions(serverSessions, new Date()));
  }, [serverSessions]);

  return sessions;
}

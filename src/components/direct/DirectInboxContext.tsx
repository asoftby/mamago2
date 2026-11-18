"use client";

import { createContext, useContext } from "react";

export interface DirectInboxContextValue {
  /** The open conversation's thread id (route segment), or null on the inbox index. */
  selectedThreadId: string | null;
  /** Zero the unread badge of the list row(s) that contain these threads — no refetch. */
  markThreadsRead: (threadIds: string[]) => void;
}

export const DirectInboxContext = createContext<DirectInboxContextValue | null>(null);

/** Null outside the two-column inbox shell (e.g. a thread rendered standalone). */
export function useDirectInbox(): DirectInboxContextValue | null {
  return useContext(DirectInboxContext);
}

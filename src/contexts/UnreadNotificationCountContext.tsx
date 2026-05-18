"use client";

import {
  createContext,
  useCallback,
  useContext,
} from "react";
import { useNotificationStore } from "@/features/notifications/store";

type UnreadCtx = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const UnreadNotificationCountContext = createContext<UnreadCtx | null>(null);

/**
 * Совместимость с существующими импортам: счётчик и refresh из Zustand notification store.
 */
export function UnreadNotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const refresh = useCallback(async () => {
    await useNotificationStore.getState().refreshUnreadOnly();
  }, []);

  return (
    <UnreadNotificationCountContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </UnreadNotificationCountContext.Provider>
  );
}

export function useUnreadNotificationCountFromContext(): UnreadCtx {
  const ctx = useContext(UnreadNotificationCountContext);
  if (!ctx) {
    throw new Error(
      "useUnreadNotificationCount must be used within UnreadNotificationCountProvider",
    );
  }
  return ctx;
}

export function useOptionalUnreadNotificationCountFromContext(): UnreadCtx | null {
  return useContext(UnreadNotificationCountContext);
}

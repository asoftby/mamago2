"use client";

import { useEffect, type ReactNode } from "react";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import {
  mountNotificationEventBridge,
  useNotificationStore,
} from "@/features/notifications/store";

/**
 * Keeps notification store auth flag and polling/event bridges in sync app-wide
 * (public, business, admin) — does not render UI.
 */
export function NotificationStoreAuthSync({ children }: { children: ReactNode }) {
  const { status } = useAuthMe();
  const authed = status === "authenticated";
  const { mode, hydrated } = useAccountMode();

  useEffect(() => {
    mountNotificationEventBridge();
  }, []);

  useEffect(() => {
    useNotificationStore.getState().setAuthenticated(authed);
    if (!authed) {
      useNotificationStore.getState().reset();
    }
  }, [authed]);

  useEffect(() => {
    if (!authed || !hydrated) return;
    queueMicrotask(() => {
      const store = useNotificationStore.getState();
      if (mode === "business") {
        void store.refreshBusinessUnreadOnly();
      } else {
        void store.refreshUnreadOnly();
      }
    });
  }, [authed, hydrated, mode]);

  return <>{children}</>;
}

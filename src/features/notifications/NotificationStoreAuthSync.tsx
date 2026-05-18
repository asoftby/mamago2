"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import {
  mountNotificationEventBridge,
  setNotificationEventBridgeUnreadStream,
  unmountNotificationEventBridge,
  useNotificationStore,
} from "@/features/notifications/store";
import type { NotificationUnreadBootstrapStream } from "@/features/notifications/store/notification-surface";

/**
 * Keeps notification store auth flag and unread bridges in sync for a surface
 * that actually renders a visible notifications badge.
 */
export function NotificationStoreAuthSync({
  children,
  unreadStream = "none",
}: {
  children?: ReactNode;
  unreadStream?: NotificationUnreadBootstrapStream;
}) {
  const { status, user } = useAuthMe();
  const authed = status === "authenticated";
  const userId = authed ? user?.id ?? null : null;

  useEffect(() => {
    setNotificationEventBridgeUnreadStream(unreadStream);
  }, [unreadStream]);

  // Mount the event bridge once; tear it down on unmount.
  // This prevents HMR / StrictMode from leaking multiple intervals.
  useEffect(() => {
    mountNotificationEventBridge();
    return () => {
      unmountNotificationEventBridge();
    };
  }, []);

  // Keep the store's `authenticated` flag in sync.
  useEffect(() => {
    useNotificationStore.getState().setAuthenticated(authed, userId);
    if (!authed) {
      useNotificationStore.getState().reset();
    }
  }, [authed, userId]);

  // Bootstrap only the unread stream that backs the visible badge on this surface.
  useEffect(() => {
    if (!authed || unreadStream === "none") return;

    if (unreadStream === "business") {
      void useNotificationStore.getState().refreshBusinessUnreadOnly();
      return;
    }

    if (unreadStream === "user") {
      void useNotificationStore.getState().refreshUnreadOnly();
    }
  }, [authed, unreadStream]);

  return <>{children}</>;
}

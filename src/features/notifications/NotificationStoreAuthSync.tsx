"use client";

import { useEffect, type ReactNode } from "react";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import {
  mountNotificationEventBridge,
  unmountNotificationEventBridge,
  useNotificationStore,
} from "@/features/notifications/store";
import { isBusinessSurface } from "@/features/notifications/store/notification-surface";

/**
 * Keeps notification store auth flag and polling/event bridges in sync app-wide
 * (public, business, admin) — does not render UI.
 *
 * Phase 1 fixes applied:
 * - Bridge is properly torn down on unmount (cleanup in useEffect return).
 * - Initial fetch is surface-aware: public pages only fetch user unread.
 * - Auth effect is throttled via the store's built-in THROTTLE_MS guard.
 * - No cascading double-fetch on mode/pathname oscillation.
 */
export function NotificationStoreAuthSync({ children }: { children: ReactNode }) {
  const { status } = useAuthMe();
  const authed = status === "authenticated";
  const { mode, hydrated } = useAccountMode();

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
    useNotificationStore.getState().setAuthenticated(authed);
    if (!authed) {
      useNotificationStore.getState().reset();
    }
  }, [authed]);

  // Initial unread fetch after auth + hydration.
  // Surface-aware: public pages only fetch user unread, business pages only business unread.
  // The store's throttle guard prevents repeated fetches on mode/pathname oscillation.
  useEffect(() => {
    if (!authed || !hydrated) return;

    const onBusiness = mode === "business" || isBusinessSurface();

    if (onBusiness) {
      void useNotificationStore.getState().refreshBusinessUnreadOnly();
    } else {
      void useNotificationStore.getState().refreshUnreadOnly();
    }
    // Intentionally NOT including `mode` in deps to avoid re-fetching on every
    // AccountMode oscillation. The bridge handles subsequent refreshes via events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, hydrated]);

  return <>{children}</>;
}

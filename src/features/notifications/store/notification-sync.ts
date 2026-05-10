import {
  AUTH_STATE_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";
import { useNotificationStore } from "./notification-store";

const POLL_MS = 60_000;

let bridgeMounted = false;

let mergedRefreshQueued = false;

function scheduleMergedRefreshFromWindowEvents() {
  if (mergedRefreshQueued) return;
  mergedRefreshQueued = true;
  queueMicrotask(() => {
    mergedRefreshQueued = false;
    void useNotificationStore.getState().refresh();
  });
}

/**
 * Single mount point for window/document bridges into the notification store.
 * Must stay the only subscriber to {@link NOTIFICATIONS_CHANGED_EVENT}.
 */
export function mountNotificationEventBridge(): void {
  if (typeof window === "undefined" || bridgeMounted) {
    return;
  }
  bridgeMounted = true;

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);

  window.addEventListener(AUTH_STATE_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void useNotificationStore.getState().refreshBothUnreadCounts();
    }
  });

  window.setInterval(() => {
    void useNotificationStore.getState().refreshBothUnreadCounts();
  }, POLL_MS);
}

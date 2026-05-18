import {
  AUTH_STATE_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";
import { useNotificationStore } from "./notification-store";
import { isBusinessSurface } from "./notification-surface";

const POLL_MS = 60_000;

// ─── Bridge state ────────────────────────────────────────────────────────────

let bridgeMounted = false;
let pollIntervalId: number | null = null;

let mergedRefreshQueued = false;

// ─── Dev logging ─────────────────────────────────────────────────────────────

function devLog(msg: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[notifications] ${msg}`, ...args);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Refresh only the stream(s) appropriate for the current surface.
 * On public pages: user unread only.
 * On /business pages: business unread only.
 */
function refreshForCurrentSurface(): void {
  const store = useNotificationStore.getState();
  if (!store.authenticated) {
    devLog("skipped poll — unauthenticated");
    return;
  }

  if (isBusinessSurface()) {
    devLog("poll → refreshBusinessUnreadOnly");
    void store.refreshBusinessUnreadOnly();
  } else {
    devLog("poll → refreshUnreadOnly (public surface)");
    void store.refreshUnreadOnly();
  }
}

function scheduleMergedRefreshFromWindowEvents() {
  if (mergedRefreshQueued) return;
  mergedRefreshQueued = true;
  queueMicrotask(() => {
    mergedRefreshQueued = false;
    devLog("event bridge → refresh");
    void useNotificationStore.getState().refresh();
  });
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    devLog("visibilitychange → refreshForCurrentSurface");
    refreshForCurrentSurface();
  }
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────

/**
 * Single mount point for window/document bridges into the notification store.
 * Must stay the only subscriber to {@link NOTIFICATIONS_CHANGED_EVENT}.
 *
 * Safe to call multiple times — idempotent via `bridgeMounted` guard.
 * Call {@link unmountNotificationEventBridge} to tear down (e.g. in useEffect cleanup).
 */
export function mountNotificationEventBridge(): void {
  if (typeof window === "undefined" || bridgeMounted) {
    devLog("bridge already mounted or SSR — skipping");
    return;
  }
  bridgeMounted = true;
  devLog("bridge mounted");

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  window.addEventListener(AUTH_STATE_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Only poll on business surface; public pages don't need background polling.
  if (isBusinessSurface()) {
    devLog("bridge: starting poll interval (business surface)");
    pollIntervalId = window.setInterval(refreshForCurrentSurface, POLL_MS) as unknown as number;
  } else {
    devLog("bridge: no poll interval (public surface)");
  }
}

/**
 * Tear down all listeners and the poll interval.
 * Called from the useEffect cleanup in {@link NotificationStoreAuthSync}.
 */
export function unmountNotificationEventBridge(): void {
  if (!bridgeMounted) return;
  bridgeMounted = false;
  devLog("bridge unmounted");

  window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  window.removeEventListener(AUTH_STATE_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  document.removeEventListener("visibilitychange", onVisibilityChange);

  if (pollIntervalId !== null) {
    window.clearInterval(pollIntervalId);
    pollIntervalId = null;
    devLog("bridge: poll interval cleared");
  }
}

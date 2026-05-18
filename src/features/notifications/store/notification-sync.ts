import {
  AUTH_STATE_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";
import { useNotificationStore } from "./notification-store";
import type { NotificationUnreadBootstrapStream } from "./notification-surface";

const POLL_MS = 60_000;

// ─── Bridge state ────────────────────────────────────────────────────────────

let bridgeMountCount = 0;
let pollIntervalId: number | null = null;
let currentUnreadStream: NotificationUnreadBootstrapStream = "none";

let mergedRefreshQueued = false;

// ─── Dev logging ─────────────────────────────────────────────────────────────

function devLog(msg: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[notifications] ${msg}`, ...args);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function refreshForCurrentUnreadStream(): void {
  const store = useNotificationStore.getState();
  if (!store.authenticated) {
    devLog("skipped poll — unauthenticated");
    return;
  }

  if (currentUnreadStream === "business") {
    devLog("bridge → refreshBusinessUnreadOnly");
    void store.refreshBusinessUnreadOnly();
    return;
  }

  if (currentUnreadStream === "user") {
    devLog("bridge → refreshUnreadOnly");
    void store.refreshUnreadOnly();
    return;
  }

  devLog("bridge → skipped refresh (stream=none)");
}

function scheduleMergedRefreshFromWindowEvents() {
  if (mergedRefreshQueued) return;
  mergedRefreshQueued = true;
  queueMicrotask(() => {
    mergedRefreshQueued = false;
    devLog("event bridge → refresh current unread stream");
    refreshForCurrentUnreadStream();
  });
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    devLog("visibilitychange → refresh current unread stream");
    refreshForCurrentUnreadStream();
  }
}

function ensurePollInterval(): void {
  const shouldPoll = bridgeMountCount > 0 && currentUnreadStream === "business";

  if (shouldPoll) {
    if (pollIntervalId === null) {
      devLog("bridge: starting poll interval (business unread stream)");
      pollIntervalId = window.setInterval(
        refreshForCurrentUnreadStream,
        POLL_MS,
      ) as unknown as number;
    }
    return;
  }

  if (pollIntervalId !== null) {
    window.clearInterval(pollIntervalId);
    pollIntervalId = null;
    devLog("bridge: poll interval cleared");
  }
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────

/**
 * Single mount point for window/document bridges into the notification store.
 * Must stay the only subscriber to {@link NOTIFICATIONS_CHANGED_EVENT}.
 *
 * Safe to call multiple times — ref-counted so multiple visible consumers can
 * share a single bridge instance.
 * Call {@link unmountNotificationEventBridge} to tear down (e.g. in useEffect cleanup).
 */
export function mountNotificationEventBridge(): void {
  if (typeof window === "undefined") {
    devLog("bridge SSR — skipping");
    return;
  }

  bridgeMountCount += 1;
  if (bridgeMountCount > 1) {
    devLog("bridge mount ref++ (%d)", bridgeMountCount);
    ensurePollInterval();
    return;
  }

  devLog("bridge mounted");

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  window.addEventListener(AUTH_STATE_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  document.addEventListener("visibilitychange", onVisibilityChange);
  ensurePollInterval();
}

/**
 * Tear down all listeners and the poll interval.
 * Called from the useEffect cleanup in {@link NotificationStoreAuthSync}.
 */
export function unmountNotificationEventBridge(): void {
  if (bridgeMountCount === 0) return;
  bridgeMountCount -= 1;
  if (bridgeMountCount > 0) {
    devLog("bridge mount ref-- (%d)", bridgeMountCount);
    ensurePollInterval();
    return;
  }

  devLog("bridge unmounted");

  window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  window.removeEventListener(AUTH_STATE_CHANGED_EVENT, scheduleMergedRefreshFromWindowEvents);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  ensurePollInterval();
}

export function setNotificationEventBridgeUnreadStream(
  unreadStream: NotificationUnreadBootstrapStream,
): void {
  currentUnreadStream = unreadStream;
  if (typeof window !== "undefined") {
    ensurePollInterval();
  }
}

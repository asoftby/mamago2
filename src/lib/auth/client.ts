/**
 * Client-side auth utilities
 */

export const AUTH_STATE_CHANGED_EVENT = "auth-state-changed";
export const NOTIFICATIONS_CHANGED_EVENT = "notifications-changed";

export function notifyAuthStateChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
}

export function notifyNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

/** После login/register: обновить подписчиков auth и списка уведомлений без перезагрузки страницы. */
export function notifyPostAuthSync() {
  notifyAuthStateChanged();
  notifyNotificationsChanged();
}

export async function getCurrentUser() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

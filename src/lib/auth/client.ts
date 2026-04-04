/**
 * Client-side auth utilities
 */

export const AUTH_STATE_CHANGED_EVENT = "auth-state-changed";

export function notifyAuthStateChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
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

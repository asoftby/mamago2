"use client";

import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";

function escapeCookieName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @deprecated Не использовать как source of truth для auth:
 * session cookie httpOnly и может быть невидим для client-side JS.
 * Для auth-состояния запрашивайте /api/auth/me.
 */
export function hasClientSessionCookie(): boolean {
  if (typeof document === "undefined") return false;

  const pattern = new RegExp(`(?:^|;\\s*)${escapeCookieName(SESSION_COOKIE_NAME)}=`);
  return pattern.test(document.cookie);
}

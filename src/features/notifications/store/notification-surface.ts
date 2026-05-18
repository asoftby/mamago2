/**
 * Surface detection helpers for the notification system.
 *
 * "Business surface" = the partner cabinet (/business/*).
 * Everything else (public pages, /me/*, /admin/*) is treated as a public surface
 * for the purpose of notification polling — only user unread count is fetched there.
 */

export type NotificationUnreadBootstrapStream = "none" | "user" | "business";

/**
 * Returns true when the current page is the business partner cabinet.
 * Safe to call on the server (returns false).
 */
export function isBusinessSurface(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, hostname } = window.location;
  return (
    pathname.startsWith("/business") ||
    hostname.startsWith("business.")
  );
}

/**
 * Returns true when the current page is a public-facing page
 * (i.e. NOT the business cabinet).
 */
export function isPublicSurface(): boolean {
  return !isBusinessSurface();
}

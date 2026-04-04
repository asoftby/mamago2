/**
 * Единый UX: после успешного Save в admin/business — возврат в список + toast.
 *
 * - `returnTo` в query edit-страницы — полный путь списка с контекстом (табы, фильтры).
 * - После редиректа в URL добавляется `saved=1`; список читает его через `useBackofficeSavedToast`.
 */

export const RETURN_TO_PARAM = "returnTo";
export const SAVED_TOAST_PARAM = "saved";
export const SAVED_TOAST_VALUE = "1";

/** Разрешённые префиксы для returnTo (защита от open redirect). */
function isAllowedReturnPath(path: string): boolean {
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/business" ||
    path.startsWith("/business/")
  );
}

/**
 * Безопасный list href из query `returnTo`; при невалидном — fallback.
 */
export function sanitizeReturnTo(raw: string | null | undefined, fallback: string): string {
  if (raw == null || raw === "") return fallback;
  try {
    const decoded = decodeURIComponent(raw.trim());
    if (!decoded.startsWith("/")) return fallback;
    if (!isAllowedReturnPath(decoded.split("?")[0] ?? "")) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

/** Добавляет `saved=1` для показа toast на странице списка. */
export function withSavedToastQuery(href: string): string {
  try {
    const u = new URL(href, "http://local.invalid");
    u.searchParams.set(SAVED_TOAST_PARAM, SAVED_TOAST_VALUE);
    return u.pathname + u.search + u.hash;
  } catch {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}${SAVED_TOAST_PARAM}=${SAVED_TOAST_VALUE}`;
  }
}

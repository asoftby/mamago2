import { getSafeRedirectPath } from "./redirectTo";

/**
 * Разрешённые значения query `next` / `redirectTo` после логина: только относительные пути приложения.
 * @deprecated Prefer getSafeRedirectPath(value, fallback) for resolved paths.
 */
export function isSafeNextPath(next: string | undefined): boolean {
  if (!next) return false;
  return getSafeRedirectPath(next, "") !== "";
}

/**
 * Разрешённые значения query `next` после логина: только относительные пути приложения.
 */
export function isSafeNextPath(next: string | undefined): boolean {
  if (!next || typeof next !== "string") return false;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return false;
  if (t.includes("://")) return false;
  return true;
}

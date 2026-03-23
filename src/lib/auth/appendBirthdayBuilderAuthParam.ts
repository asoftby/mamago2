/**
 * После входа с `next` на конструктор дня рождения добавляем маркер,
 * чтобы на клиенте один раз выполнить сценарий (ребёнок / модалка / sheet).
 */
export function appendBirthdayBuilderAuthParam(href: string): string {
  if (!href || typeof href !== "string") return href;
  if (!href.includes("/birthday/make")) return href;
  if (href.includes("bbAuth=")) return href;
  return href.includes("?") ? `${href}&bbAuth=1` : `${href}?bbAuth=1`;
}

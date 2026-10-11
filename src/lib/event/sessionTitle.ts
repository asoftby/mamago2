export const SESSION_TITLE_MAX_LENGTH = 120;

/** Название сеанса: trim, пустая строка / не строка → null, обрезка до 120 символов. */
export function normalizeSessionTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > SESSION_TITLE_MAX_LENGTH
    ? trimmed.slice(0, SESSION_TITLE_MAX_LENGTH).trimEnd()
    : trimmed;
}

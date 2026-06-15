/** Какие сущности сохраняют старый slug в history при ручной смене через SEO editor. */
export type SlugHistoryEntityKind = "article" | "event" | "place" | "offer" | "route";

export const ENTITY_SLUG_HISTORY_REDIRECT_SUPPORTED: Record<SlugHistoryEntityKind, boolean> = {
  article: true,
  event: true,
  place: true,
  offer: true,
  route: true,
};

export function entitySupportsSlugHistoryRedirect(kind: SlugHistoryEntityKind): boolean {
  return ENTITY_SLUG_HISTORY_REDIRECT_SUPPORTED[kind];
}

export const SLUG_CHANGE_REDIRECT_WARNING =
  "Изменение slug изменит публичный URL. Старый адрес должен быть сохранён как редирект.";

export const SLUG_CHANGE_URL_WARNING =
  "Изменение slug изменит публичный URL.";

export function slugChangeWarningMessage(supportsHistoryRedirect: boolean): string {
  return supportsHistoryRedirect ? SLUG_CHANGE_REDIRECT_WARNING : SLUG_CHANGE_URL_WARNING;
}

export function slugChangeWarningMessageForKind(kind: SlugHistoryEntityKind): string {
  return slugChangeWarningMessage(entitySupportsSlugHistoryRedirect(kind));
}

export function slugFieldHelperText(supportsHistoryRedirect: boolean): string {
  return supportsHistoryRedirect
    ? "Меняется только вручную. При изменении сохраняем redirect со старого slug."
    : "Меняется только вручную. Изменение slug изменит публичный URL.";
}

/**
 * Family Core M4b: pure view rules for the shared "Мой план" screen.
 * With a single adult none of this is shown (no chips, locks or share actions).
 */

export type PlanScopeFilter = "all" | "family" | "mine";

/** Fields are optional: items added client-side (before a reload) carry no author data and count as own, shared. */
export type PlanVisibilityItem = {
  visibility?: "PRIVATE" | "FAMILY";
  authorId?: string;
  authorName?: string | null;
};

export type FamilyView = {
  currentUserId: string;
  adultsCount: number;
};

export const PLAN_SCOPE_STORAGE_KEY = "mamago.plan.scope";

export function showFamilyUi(view: FamilyView | null | undefined): view is FamilyView {
  return !!view && view.adultsCount > 1;
}

export function parsePlanScopeFilter(raw: string | null | undefined): PlanScopeFilter {
  return raw === "family" || raw === "mine" ? raw : "all";
}

/** "Моё" = everything I authored (private and shared); "Семья" = shared items of any author. */
export function filterByScope<T extends PlanVisibilityItem>(
  items: T[],
  filter: PlanScopeFilter,
  currentUserId: string,
): T[] {
  if (filter === "family") return items.filter((i) => (i.visibility ?? "FAMILY") === "FAMILY");
  if (filter === "mine") return items.filter((i) => (i.authorId ?? currentUserId) === currentUserId);
  return items;
}

/** Caption for a shared item added by someone else; null for own items. */
export function authorCaption(item: PlanVisibilityItem, currentUserId: string): string | null {
  if ((item.visibility ?? "FAMILY") !== "FAMILY" || !item.authorId || item.authorId === currentUserId) return null;
  return `Добавил(а) ${item.authorName?.trim() || "другой взрослый"}`;
}

export type VisibilityErrorCode =
  | "disabled"
  | "not_found"
  | "not_author"
  | "wrong_state"
  | "other_adult_acted"
  | "conflict";

/** User-facing message for a failed visibility change. */
export function visibilityErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "conflict":
      return "Пункт только что изменили. Показываем свежую версию.";
    case "other_adult_acted":
      return "Нельзя сделать личным: другой взрослый уже изменил этот пункт.";
    case "not_author":
      return "Менять видимость может только автор пункта.";
    case "not_found":
      return "Пункт не найден или уже удалён.";
    default:
      return "Не удалось изменить видимость.";
  }
}

/** Errors after which the screen should reload the fresh server state. */
export function shouldRefreshAfter(code: string | null | undefined): boolean {
  return code === "conflict" || code === "not_found" || code === "wrong_state";
}

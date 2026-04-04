/** После отложенного hard delete список категорий подписывается и перезагружает данные. */
export const EVENT_CATEGORY_HARD_DELETED = "mamago:event-category-hard-deleted";

export type EventCategoryHardDeletedDetail = { id: string };

export function dispatchEventCategoryHardDeleted(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<EventCategoryHardDeletedDetail>(EVENT_CATEGORY_HARD_DELETED, {
      detail: { id },
    }),
  );
}

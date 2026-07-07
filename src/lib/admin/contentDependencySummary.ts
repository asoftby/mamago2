export type ContentDependencyItem = {
  type: string;
  label: string;
  count: number;
  blocking: boolean;
  href?: string;
};

export type ContentDependencySummary = {
  total: number;
  blockingTotal: number;
  items: ContentDependencyItem[];
};

export function buildContentDependencySummary(
  items: ContentDependencyItem[],
): ContentDependencySummary {
  const visible = items.filter((item) => item.count > 0);
  return {
    total: visible.reduce((sum, item) => sum + item.count, 0),
    blockingTotal: visible
      .filter((item) => item.blocking)
      .reduce((sum, item) => sum + item.count, 0),
    items: visible,
  };
}

export function formatDependencyList(items: ContentDependencyItem[]): string {
  return items.map((item) => `• ${item.label}: ${item.count}`).join("\n");
}

export function blockingDependencyItems(
  summary: ContentDependencySummary,
): ContentDependencyItem[] {
  return summary.items.filter((item) => item.blocking && item.count > 0);
}

export function nonBlockingDependencyItems(
  summary: ContentDependencySummary,
): ContentDependencyItem[] {
  return summary.items.filter((item) => !item.blocking && item.count > 0);
}

export const HARD_DELETE_BLOCK_MESSAGE =
  "Удаление невозможно. С этой публикацией уже связаны другие данные или публикации. Используйте архивирование.";

export function hardDeleteBlockMessage(reasons: string[]): string {
  if (reasons.includes("statusNotDraft")) {
    return "Удаление доступно только для черновиков. Для опубликованных записей используйте архивирование.";
  }
  if (reasons.includes("offers")) {
    return "Нельзя удалить место: у него есть опубликованные или активные предложения. Сначала архивируйте или удалите их.";
  }
  if (reasons.includes("activities")) {
    return "Нельзя удалить место: у него есть опубликованные или активные события. Сначала архивируйте или удалите их.";
  }
  if (reasons.includes("children")) {
    return "Нельзя удалить место: у него есть опубликованные дочерние локации. Сначала архивируйте или удалите их.";
  }
  if (reasons.includes("bookingRequests")) {
    return "Нельзя удалить: есть связанные заявки на бронирование.";
  }
  if (reasons.includes("reviews")) {
    return "Нельзя удалить: у места есть отзывы пользователей.";
  }

  return HARD_DELETE_BLOCK_MESSAGE;
}

import type { EventCategoryPublicationType } from "@prisma/client";

export const EVENT_CATEGORY_PUBLICATION_TYPES: EventCategoryPublicationType[] = [
  "EVENT",
  "PLACE",
  "OFFER",
  "ROUTE",
  "ARTICLE",
];

/** Подписи табов / колонки (как в ТЗ). */
export const EVENT_CATEGORY_TYPE_TAB_LABELS: Record<EventCategoryPublicationType, string> = {
  EVENT: "Events",
  PLACE: "Places",
  OFFER: "Offers",
  ROUTE: "Routes",
  ARTICLE: "Articles",
};

export function parseEventCategoryPublicationType(
  raw: unknown,
): EventCategoryPublicationType | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toUpperCase();
  return EVENT_CATEGORY_PUBLICATION_TYPES.includes(s as EventCategoryPublicationType)
    ? (s as EventCategoryPublicationType)
    : null;
}

export function mapCategoryRow<T extends { publicationType: EventCategoryPublicationType }>(
  row: T,
): Omit<T, "publicationType"> & { type: EventCategoryPublicationType } {
  const { publicationType, ...rest } = row;
  return { ...rest, type: publicationType };
}

/** Ответ API админки: `type` вместо `publicationType`, то же для `parent`. */
export function mapCategoryWithParent<
  T extends {
    publicationType: EventCategoryPublicationType;
    parent:
      | ({ publicationType: EventCategoryPublicationType } & Record<string, unknown>)
      | null;
  },
>(item: T) {
  const { parent, ...rest } = item;
  return {
    ...mapCategoryRow(rest),
    parent: parent ? mapCategoryRow(parent) : null,
  };
}

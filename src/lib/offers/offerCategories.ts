import type { OfferProductType } from "@prisma/client";

/** Максимум категорий на предложение. */
export const MAX_OFFER_CATEGORIES = 3;

/**
 * Откуда берутся категории предложения (решение 5 фазы 0):
 * - праздники / лагеря / занятия — `EventCategory(publicationType=OFFER)`, формат кодируется
 *   префиксом slug: `party-*`, `camp-*`, `class-*`;
 * - «Место / посещение» — корневые `EventCategory(publicationType=PLACE)`.
 */
export type OfferCategoryScope =
  | { kind: "offer-prefix"; prefix: "party-" | "camp-" | "class-" }
  | { kind: "place-root" };

export function offerCategoryScopeForProductType(
  productType: OfferProductType | null | undefined,
): OfferCategoryScope | null {
  switch (productType) {
    case "PARTY_SERVICE":
    case "PARTY_PACKAGE":
      return { kind: "offer-prefix", prefix: "party-" };
    case "CAMP":
      return { kind: "offer-prefix", prefix: "camp-" };
    case "REGULAR_ACTIVITY":
    case "ONE_TIME_ACTIVITY":
      return { kind: "offer-prefix", prefix: "class-" };
    case "PLACE_VISIT":
      return { kind: "place-root" };
    default:
      return null;
  }
}

/** Подходит ли категория под формат предложения. */
export function isCategoryInScope(
  scope: OfferCategoryScope,
  category: { publicationType: string; slug: string; parentId: string | null; isActive: boolean; archivedAt?: Date | null },
): boolean {
  if (!category.isActive || category.archivedAt) return false;
  if (scope.kind === "place-root") {
    return category.publicationType === "PLACE" && category.parentId === null;
  }
  return category.publicationType === "OFFER" && category.slug.startsWith(scope.prefix);
}

export type CategoryIdsCheck =
  | { ok: true; ids: string[] }
  | { ok: false; reason: "TOO_MANY" | "INVALID" };

/** Форма списка: строки без дублей, не больше `MAX_OFFER_CATEGORIES`. Порядок сохраняется. */
export function checkCategoryIdsShape(value: unknown): CategoryIdsCheck {
  if (!Array.isArray(value)) return { ok: false, reason: "INVALID" };
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return { ok: false, reason: "INVALID" };
    const id = item.trim();
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_OFFER_CATEGORIES) return { ok: false, reason: "TOO_MANY" };
  return { ok: true, ids };
}

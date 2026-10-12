import type { OfferProductType, Prisma } from "@prisma/client";
import {
  checkCategoryIdsShape,
  isCategoryInScope,
  offerCategoryScopeForProductType,
} from "@/lib/offers/offerCategories";

type CategoryDb = Pick<Prisma.TransactionClient, "eventCategory" | "offerCategory">;

export class OfferCategoriesError extends Error {
  constructor(public readonly code: "TOO_MANY" | "INVALID") {
    super(code === "TOO_MANY" ? "offer_categories_too_many" : "offer_categories_invalid");
  }
}

const CATEGORY_SELECT = {
  id: true,
  nameRu: true,
  slug: true,
  publicationType: true,
  parentId: true,
  isActive: true,
  archivedAt: true,
  sortOrder: true,
} as const;

/** Категории, доступные для выбора при данном формате предложения. */
export async function listOfferCategories(
  db: Pick<Prisma.TransactionClient, "eventCategory">,
  productType: OfferProductType | null | undefined,
) {
  const scope = offerCategoryScopeForProductType(productType);
  if (!scope) return [];

  const rows = await db.eventCategory.findMany({
    where:
      scope.kind === "place-root"
        ? { publicationType: "PLACE", parentId: null, isActive: true, archivedAt: null }
        : {
            publicationType: "OFFER",
            slug: { startsWith: scope.prefix },
            isActive: true,
            archivedAt: null,
          },
    select: CATEGORY_SELECT,
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
  });
  return rows.map((row) => ({ id: row.id, nameRu: row.nameRu, slug: row.slug }));
}

/** Проверить список id: форма, существование, принадлежность формату предложения. */
export async function resolveOfferCategoryIds(
  db: Pick<Prisma.TransactionClient, "eventCategory">,
  productType: OfferProductType | null | undefined,
  rawIds: unknown,
): Promise<string[]> {
  const shape = checkCategoryIdsShape(rawIds);
  if (!shape.ok) throw new OfferCategoriesError(shape.reason);
  if (shape.ids.length === 0) return [];

  const scope = offerCategoryScopeForProductType(productType);
  if (!scope) throw new OfferCategoriesError("INVALID");

  const categories = await db.eventCategory.findMany({
    where: { id: { in: shape.ids } },
    select: CATEGORY_SELECT,
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const id of shape.ids) {
    const category = byId.get(id);
    if (!category || !isCategoryInScope(scope, category)) throw new OfferCategoriesError("INVALID");
  }
  return shape.ids;
}

/** Заменить категории предложения (порядок выбора сохраняется). */
export async function syncOfferCategories(params: {
  db: CategoryDb;
  offerId: string;
  productType: OfferProductType | null | undefined;
  categoryIds: unknown;
}): Promise<string[]> {
  const ids = await resolveOfferCategoryIds(params.db, params.productType, params.categoryIds);
  await params.db.offerCategory.deleteMany({ where: { offerId: params.offerId } });
  if (ids.length > 0) {
    await params.db.offerCategory.createMany({
      data: ids.map((categoryId, index) => ({
        offerId: params.offerId,
        categoryId,
        sortOrder: index,
      })),
    });
  }
  return ids;
}

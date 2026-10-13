import type { OfferProductType, Prisma } from "@prisma/client";
import {
  checkCategoryIdsShape,
  isCategoryInScope,
  offerCategoryScopeForProductType,
} from "@/lib/offers/offerCategories";

type CategoryDb = Pick<Prisma.TransactionClient, "eventCategory" | "offerCategory" | "discoveryClassChip">;
type CategoryReadDb = Pick<Prisma.TransactionClient, "eventCategory" | "discoveryClassChip">;

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

/**
 * Категории занятий = активные `DiscoveryClassChip` (slug с префиксом `class-`). Чипы заводятся сидом уже
 * после миграций, поэтому миграция не может скопировать их надёжно: недостающие категории досоздаются
 * идемпотентно при чтении/проверке (свежая БД, новые чипы). Существующие не меняются.
 */
export async function syncClassOfferCategories(db: CategoryReadDb): Promise<void> {
  const chips = await db.discoveryClassChip.findMany({
    where: { isActive: true },
    select: { slug: true, title: true, sortOrder: true },
  });
  if (chips.length === 0) return;

  const existing = await db.eventCategory.findMany({
    where: { publicationType: "OFFER", slug: { startsWith: "class-" } },
    select: { slug: true },
  });
  const known = new Set(existing.map((category) => category.slug));
  const missing = chips.filter((chip) => !known.has(`class-${chip.slug}`));
  if (missing.length === 0) return;

  await db.eventCategory.createMany({
    data: missing.map((chip) => ({
      nameRu: chip.title,
      nameEn: chip.title,
      slug: `class-${chip.slug}`,
      sortOrder: chip.sortOrder,
      isActive: true,
      publicationType: "OFFER" as const,
    })),
    skipDuplicates: true,
  });
}

/** Категории, доступные для выбора при данном формате предложения. */
export async function listOfferCategories(
  db: CategoryReadDb,
  productType: OfferProductType | null | undefined,
) {
  const scope = offerCategoryScopeForProductType(productType);
  if (!scope) return [];
  if (scope.kind === "offer-prefix" && scope.prefix === "class-") await syncClassOfferCategories(db);

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
  db: CategoryReadDb & Partial<Pick<Prisma.TransactionClient, "offerCategory">>,
  productType: OfferProductType | null | undefined,
  rawIds: unknown,
  /** Уже назначенные этому офферу категории остаются допустимыми, даже если справочник с тех пор изменился. */
  offerId?: string,
): Promise<string[]> {
  const shape = checkCategoryIdsShape(rawIds);
  if (!shape.ok) throw new OfferCategoriesError(shape.reason);
  if (shape.ids.length === 0) return [];

  const alreadyAssigned =
    offerId && db.offerCategory
      ? new Set(
          (
            await db.offerCategory.findMany({ where: { offerId }, select: { categoryId: true } })
          ).map((link) => link.categoryId),
        )
      : new Set<string>();

  const scope = offerCategoryScopeForProductType(productType);
  if (!scope) {
    // Без формата можно только оставить уже назначенное.
    if (shape.ids.every((id) => alreadyAssigned.has(id))) return shape.ids;
    throw new OfferCategoriesError("INVALID");
  }

  if (scope.kind === "offer-prefix" && scope.prefix === "class-") await syncClassOfferCategories(db);

  const categories = await db.eventCategory.findMany({
    where: { id: { in: shape.ids } },
    select: CATEGORY_SELECT,
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const id of shape.ids) {
    const category = byId.get(id);
    if (!category) throw new OfferCategoriesError("INVALID");
    // Без этого неизменённая категория, которую админ позже деактивировал/архивировал/переместил,
    // блокировала бы любые правки оффера (мастер всегда отправляет все загруженные id).
    if (alreadyAssigned.has(id)) continue;
    if (!isCategoryInScope(scope, category)) throw new OfferCategoriesError("INVALID");
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
  const ids = await resolveOfferCategoryIds(params.db, params.productType, params.categoryIds, params.offerId);
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

import { prismaBase } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { filterPopulatedClassChips } from "@/lib/discovery/filterPopulatedClassChips";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { resolveTerritoryScope, placeInTerritoryScopeWhere } from "@/server/territory/territoryScope";
import { getDiscoveryRegionContext } from "@/server/geo/boostRegionTargeting";
import { buildClassesDiscoveryWhere } from "@/server/discovery/classesDiscoveryFeed";
import type { Prisma } from "@prisma/client";


export type DiscoveryClassChipRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  entityType: string;
  surfaceKey: string;
  signalDefinitionId: string | null;
};

export async function listDiscoveryClassChips(options?: {
  includeInactive?: boolean;
}): Promise<DiscoveryClassChipRecord[]> {
  const includeInactive = options?.includeInactive ?? false;
  try {
    return await prismaBase.discoveryClassChip.findMany({
      where: {
        surfaceKey: "CLASSES",
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  } catch (err) {
    // Таблица ещё не создана (миграция не применена) — возвращаем пустой массив
    // чтобы страница не падала в runtime
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      console.warn("[classChips] DiscoveryClassChip table not found, returning empty list");
      return [];
    }
    throw err;
  }
}

/**
 * Public navigation only: show chips backed by at least one publicly discoverable
 * SERVICE Offer in this city. Reuse the same visibility/territory/paid-boost
 * predicate as the Classes listing, independently of a selected chip.
 *
 * Price and persona filters deliberately do not shrink navigation: they refine
 * results, not which categories the city offers.
 */
export async function listPopulatedDiscoveryClassChips(
  cityId: string,
  citySlug: string,
  configuredChips?: DiscoveryClassChipRecord[],
): Promise<DiscoveryClassChipRecord[]> {
  const chips = configuredChips ?? await listDiscoveryClassChips();
  if (chips.length === 0) return [];

  const inventory = await unstable_cache(async () => {
    const now = new Date();
    const [scope, targetRegionId] = await Promise.all([
      resolveTerritoryScope(citySlug),
      getDiscoveryRegionContext(cityId, citySlug),
    ]);
    const placeWhere = scope ? placeInTerritoryScopeWhere(scope.territoryIds) : { cityId };
    const publicWhere = getPublicPublishedOfferWhere(now);
    const publicWhereParts = (publicWhere.AND ?? []) as Prisma.OfferWhereInput[];
    const where = buildClassesDiscoveryWhere({
      publicWhereParts, cityId, placeWhere, targetRegionId,
      chipSlug: null, now, free: false, priceMax: null,
    });

    try {
      // One bounded existence probe for «Все», followed by at most one probe
      // per configured active category. No catalogue-sized rows are fetched.
      const anyOffer = await prismaBase.offer.findFirst({
        where,
        select: { id: true },
      });
      if (!anyOffer) {
        return { hasPublishedClasses: false, populatedSlugs: [] as string[] };
      }

      const populatedSlugs: string[] = [];
      const activeCategories = chips.filter((chip) => chip.isActive && chip.slug !== "all");
      // Keep the database fan-out bounded even if an admin adds many chips.
      for (let offset = 0; offset < activeCategories.length; offset += 4) {
        const batch = activeCategories.slice(offset, offset + 4);
        const found = await Promise.all(batch.map((chip) =>
          prismaBase.offer.findFirst({
            where: { AND: [where, { classChipSlugs: { has: chip.slug } }] },
            select: { id: true },
          }),
        ));
        for (let index = 0; index < batch.length; index += 1) {
          if (found[index]) populatedSlugs.push(batch[index].slug);
        }
      }
      return { hasPublishedClasses: true, populatedSlugs };
    } catch (error) {
      // A not-yet-migrated installation can still show "Все", but must not
      // invent chip availability when classChipSlugs is absent.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("classChipSlugs") && !message.includes("P2022")) throw error;
      const offer = await prismaBase.offer.findFirst({ where, select: { id: true } });
      return { hasPublishedClasses: Boolean(offer), populatedSlugs: [] as string[] };
    }
  }, ["populated-classes-chips-v2", cityId, citySlug, chips.filter((chip) => chip.isActive && chip.slug !== "all").map((chip) => chip.slug).sort().join("|")], { revalidate: 60 })();

  return filterPopulatedClassChips(chips, inventory.hasPublishedClasses, new Set(inventory.populatedSlugs));
}

export function resolveDiscoveryClassChipSlug(
  requestedSlug: string | null | undefined,
  chips: Array<Pick<DiscoveryClassChipRecord, "slug" | "isActive" | "isDefault">>,
): string {
  const normalized = (requestedSlug ?? "").trim().toLowerCase();
  if (normalized) {
    const exact = chips.find((chip) => chip.slug === normalized && chip.isActive);
    if (exact) return exact.slug;
  }

  const defaultChip = chips.find((chip) => chip.isDefault && chip.isActive);
  if (defaultChip) return defaultChip.slug;

  return "all";
}

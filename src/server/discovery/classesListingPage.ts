import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { getDiscoveryRegionContext } from "@/server/geo/boostRegionTargeting";
import { buildClassesDiscoveryWhere, extractOfferDateRange, getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";

/** Rank all public candidate IDs using the established boost/date/ID ordering,
 * then load complete card details only for the 24 visible IDs. */
export async function getClassesListingPage(
  cityId: string,
  citySlug: string,
  options: { page: number; chipSlug: string | null; chipTitleBySlug: Map<string, string>; free: boolean; priceMax: number | null },
) {
  const page = Number.isSafeInteger(options.page) && options.page > 0 ? options.page : 1;
  const pageSize = 24;
  const chipSlug = options.chipSlug === "all" ? null : options.chipSlug;
  const priceMax = options.free ? null : options.priceMax;
  const orderedIds = await unstable_cache(async () => {
    const now = new Date();
    const publicWhere = getPublicPublishedOfferWhere();
    const targetRegionId = await getDiscoveryRegionContext(cityId, citySlug);
    const publicWhereParts = (publicWhere.AND ?? []) as import("@prisma/client").Prisma.OfferWhereInput[];
    const where = buildClassesDiscoveryWhere({ publicWhereParts, cityId, targetRegionId, chipSlug, now, free: options.free, priceMax });
    const select = {
      id: true, dateFrom: true, dateTo: true, campSessions: true,
      boosts: { where: { startAt: { lte: now }, endAt: { gt: now } }, select: { id: true } },
    } as const;
    // Only ID, date signals and boost membership: never fetch full offer cards.
    const candidates = await prisma.offer.findMany({ where, select }).catch((error: unknown) => {
      // Match the existing class-feed fallback for installations pending the
      // classChipSlugs migration. Never silently ignore unrelated DB failures.
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes("classChipSlugs") && !msg.includes("P2022")) throw error;
      const fallbackWhere = buildClassesDiscoveryWhere({
        publicWhereParts, cityId, targetRegionId, chipSlug: null, now,
        free: options.free, priceMax, skipChipSlugsSelect: true,
      });
      return prisma.offer.findMany({ where: fallbackWhere, select });
    });
    return candidates.map((offer) => ({
      id: offer.id,
      boosted: offer.boosts.length > 0,
      date: extractOfferDateRange(offer).dateStart ?? null,
    })).sort((a, b) =>
      Number(b.boosted) - Number(a.boosted)
      || (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0)
      || b.id.localeCompare(a.id)
    ).map((offer) => offer.id);
  }, ["classes-ranked-ids-v1", cityId, citySlug, chipSlug ?? "", String(options.free), String(priceMax ?? "")], { revalidate: 60 })();

  const total = orderedIds.length;
  const visibleIds = orderedIds.slice((page - 1) * pageSize, page * pageSize);
  const cards = visibleIds.length > 0
    ? await getClassesDiscoveryFeed(cityId, citySlug, {
        onlyIds: visibleIds, take: visibleIds.length, chipSlug,
        chipTitleBySlug: options.chipTitleBySlug, free: options.free, priceMax,
      })
    : [];
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  return {
    activities: visibleIds.flatMap((id) => {
      const card = cardsById.get(id);
      return card ? [card] : [];
    }),
    page, total, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

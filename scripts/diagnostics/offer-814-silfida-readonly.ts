/**
 * #814: read-only, targeted PROD offer diagnostic.
 * Run with the existing server DATABASE_URL (never print or commit credentials).
 * Does not mutate database, change publication statuses or print profile parameters.
 */
import { prisma } from "@/lib/prisma";
import { getOfferHiddenReason } from "@/lib/offers/offerVisibility";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

const slug = "gimnastika-dlya-devochek-silfida";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");
  const [current, aliases] = await Promise.all([
    prisma.offer.findMany({
      where: { slug },
      select: {
        id: true, slug: true, status: true, archivedAt: true, cityId: true, placeId: true,
        place: { select: { status: true, archivedAt: true,
          city: { select: { slug: true } },
          ownerBusiness: { select: { operationalStatus: true } },
        } },
      },
    }),
    prisma.offerSlugHistory.findMany({ where: { slug }, select: { offerId: true, cityId: true } }),
  ]);
  const ids = [...new Set([...current.map(o => o.id), ...aliases.map(a => a.offerId)])];
  const offers = await prisma.offer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, slug: true, status: true, archivedAt: true, cityId: true, placeId: true,
      place: { select: { status: true, archivedAt: true,
        city: { select: { slug: true } },
        ownerBusiness: { select: { operationalStatus: true } },
      } },
    },
  });
  const publiclySelected = await prisma.offer.findMany({
    where: { AND: [{ id: { in: ids } }, getPublicPublishedOfferWhere()] },
    select: { id: true },
  });
  const matches = new Set(publiclySelected.map(o => o.id));
  const output = {
    slug, foundCurrent: current.length, foundAliases: aliases.length,
    offers: offers.map(o => ({
      id: o.id, actualSlug: o.slug, cityId: o.cityId,
      actualCitySlug: o.place?.city?.slug ?? null,
      status: o.status, archived: Boolean(o.archivedAt),
      hasPlace: Boolean(o.placeId), placeStatus: o.place?.status ?? null,
      placeArchived: Boolean(o.place?.archivedAt),
      businessOperationalStatus: o.place?.ownerBusiness?.operationalStatus ?? null,
      hiddenReason: getOfferHiddenReason(o), passesSqlPublicPredicate: matches.has(o.id),
      aliasCityIds: aliases.filter(a => a.offerId === o.id).map(a => a.cityId),
    })),
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
main().catch(e => { console.error("Offer diagnostic failed:", e instanceof Error ? e.name : "error"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

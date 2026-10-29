import { resolveTerritoryScope } from "@/server/territory/territoryScope";
import { ActivityFormat, type AgePolicy, type PartyCategory, type PublicationPriceMode } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import type { ActivityMock } from "@/types/activity";
import { getPublicBirthdayOfferWhere } from "@/server/birthday/birthdayOfferVisibility";

const CATEGORY_LABELS: Partial<Record<PartyCategory, string>> = {
  VENUE: "Площадка",
  ANIMATOR: "Аниматор",
  SHOW: "Шоу",
  MASTER_CLASS: "Мастер-класс",
  CAKE: "Торт",
  FOOD: "Угощения",
  DECOR: "Декор",
  PHOTO: "Фото",
  PROGRAM: "Программа",
  OTHER: "Услуга для праздника",
};

type BirthdayCardOffer = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  coverImage: string | null;
  productType: "PARTY_SERVICE" | "PARTY_PACKAGE";
  category: PartyCategory | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  agePolicy: AgePolicy;
  priceMode: PublicationPriceMode;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
};

/** Party offers are OFFER cards, never EVENT/Activity cards from «Куда пойти». */
export function projectBirthdayOfferCard(offer: BirthdayCardOffer, citySlug: string): ActivityMock {
  return {
    id: offer.id,
    slug: offer.slug,
    citySlug,
    href: getOfferPublicPath(offer, citySlug),
    type: "BIRTHDAY_BOOKING",
    discoveryIntent: "birthday",
    analyticsEntityType: "OFFER",
    title: offer.title,
    description: offer.description ?? "",
    image: offer.coverImage ?? "",
    format: ActivityFormat.OFFLINE,
    ageFrom: offer.ageMinMonths == null ? 0 : Math.max(0, Math.floor(offer.ageMinMonths / 12)),
    ageTo: offer.ageMaxMonths == null ? 17 : Math.ceil(offer.ageMaxMonths / 12),
    agePolicy: offer.agePolicy,
    priceMode: offer.priceMode,
    priceMin: offer.priceFrom ?? undefined,
    priceMax: offer.priceTo ?? undefined,
    currency: offer.currency as ActivityMock["currency"],
    tags: [],
    badge: offer.productType === "PARTY_PACKAGE"
      ? "Праздник под ключ"
      : (offer.category ? CATEGORY_LABELS[offer.category] : null) ?? "Услуга для праздника",
  };
}

/** Stable, database-paginated public birthday catalog. */
export async function getBirthdayDiscoveryPage(
  cityId: string,
  citySlug: string,
  requestedPage: number,
  requestedPageSize = 24,
) {
  const pageSize = Math.max(1, Math.min(60, Math.trunc(requestedPageSize) || 24));
  const page = Math.max(1, Math.trunc(requestedPage) || 1);
  const scope = await resolveTerritoryScope(citySlug);
  const where = getPublicBirthdayOfferWhere(cityId, scope?.territoryIds);
  const [total, rows] = await prisma.$transaction([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      select: {
        id: true, slug: true, title: true, description: true, coverImage: true,
        place: { select: { city: { select: { slug: true } } } },
        productType: true, category: true, ageMinMonths: true, ageMaxMonths: true,
        agePolicy: true, priceMode: true, priceFrom: true, priceTo: true, currency: true,
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const activities = rows.flatMap((offer): ActivityMock[] =>
    offer.slug && (offer.productType === "PARTY_SERVICE" || offer.productType === "PARTY_PACKAGE")
      ? [projectBirthdayOfferCard({ ...offer, productType: offer.productType }, offer.place?.city?.slug ?? citySlug)]
      : [],
  );
  return { activities, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** @deprecated Use getBirthdayDiscoveryPage for visible catalog pages. */
export async function getBirthdayDiscoveryFeed(cityId: string, citySlug: string): Promise<ActivityMock[]> {
  return (await getBirthdayDiscoveryPage(cityId, citySlug, 1, 80)).activities;
}

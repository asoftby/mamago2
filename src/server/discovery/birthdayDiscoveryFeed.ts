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

/** Published offers approved for the birthday section — no events and no mock fill. */
export async function getBirthdayDiscoveryFeed(cityId: string, citySlug: string): Promise<ActivityMock[]> {
  const rows = await prisma.offer.findMany({
    where: getPublicBirthdayOfferWhere(cityId),
    select: {
      id: true, slug: true, title: true, description: true, coverImage: true,
      productType: true, category: true, ageMinMonths: true, ageMaxMonths: true,
      agePolicy: true, priceMode: true, priceFrom: true, priceTo: true, currency: true,
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 80,
  });

  return rows.flatMap((offer): ActivityMock[] => {
    if (!offer.slug || (offer.productType !== "PARTY_SERVICE" && offer.productType !== "PARTY_PACKAGE")) return [];
    return [projectBirthdayOfferCard({ ...offer, productType: offer.productType }, citySlug)];
  });
}

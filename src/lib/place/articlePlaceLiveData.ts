import "server-only";

import prisma from "@/lib/prisma";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
import { contactsFromArticlePlace } from "@/lib/place/articlePlaceContacts";
import { sharedPriceFromPublication, type SharedPriceData } from "@/domain/pricing/structuredPrice";
import { openingHoursFromRelational, type SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { getPlacePublicPath } from "@/lib/placePublicUrl";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import type { ArticlePlaceSections } from "@/lib/publications/articleMvp";
import {
  getArticlePlaceEmbedData,
  type ResolvedPlaceEmbedCard,
} from "@/lib/place/articlePlaceEmbedData";

export type ResolvedArticlePlace = {
  id: string;
  title: string;
  href: string;
  imageUrl: string | null;
  description: string | null;
  address: string | null;
  contacts: SharedContactsData;
  price: SharedPriceData;
  openingHours: SharedOpeningHoursData | null;
  /**
   * Rich editorial Place card used by the public article renderer.
   * The legacy/live fields above stay available for section helpers and
   * compatibility, while the visual card reuses the approved expandable
   * ArticlePlaceEmbed design.
   */
  embedCard?: ResolvedPlaceEmbedCard | null;
};

export type ResolvedArticlePlaceCard = {
  kind: "place-live";
  place: ResolvedArticlePlace;
  sections: ArticlePlaceSections;
};

async function resolveRichPlaceCard(placeId: string): Promise<ResolvedPlaceEmbedCard | null> {
  try {
    return await getArticlePlaceEmbedData(placeId);
  } catch (error) {
    // Rich data (rating/events/offers/logo) are an enhancement. A transient
    // failure for one Place must not reject the whole Article; the caller
    // keeps the already-resolved structured Place and renders its fallback.
    console.error("[article-place] rich embed resolution failed", { placeId, error });
    return null;
  }
}

/** One public Place query for every PLACE reference in an Article. */
export async function loadArticlePlacesByIds(ids: string[]): Promise<Map<string, ResolvedArticlePlace>> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const places = await prisma.place.findMany({
    where: { AND: [{ id: { in: uniqueIds } }, getPublicPublishedPlaceWhere()] },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDesc: true,
      formattedAddr: true,
      customAddress: true,
      shortAddress: true,
      floor: true,
      unit: true,
      unitLabel: true,
      phone: true,
      phoneLabel: true,
      phone2: true,
      phone2Label: true,
      phone3: true,
      phone3Label: true,
      website: true,
      instagramUrl: true,
      googleMapsUri: true,
      lat: true,
      lng: true,
      priceMode: true,
      priceFrom: true,
      priceTo: true,
      currency: true,
      priceItems: true,
      city: { select: { slug: true, name: true } },
      images: {
        where: { kind: "GALLERY" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
      openingHours: {
        select: {
          mode: true,
          timezone: true,
          note: true,
          rules: { select: { dayOfWeek: true, isOpen: true, allDay: true, intervals: { select: { startTime: true, endTime: true, sortOrder: true } } } },
          exceptions: { select: { date: true, isClosed: true, allDay: true, note: true, intervals: { select: { startTime: true, endTime: true, sortOrder: true } } } },
        },
      },
    },
  });

  // Resolve each visible Place independently. One failed rich resolver becomes
  // null for that Place only; other cards still resolve concurrently.
  const embedEntries = await Promise.all(
    places.map(async (place) => [place.id, await resolveRichPlaceCard(place.id)] as const),
  );
  const embedById = new Map(embedEntries);

  return new Map(places.flatMap((place) => {
    const href = getPlacePublicPath({ id: place.id, slug: place.slug, citySlug: place.city?.slug });
    if (!href) return [];
    const address = formatMarketplaceHeroAddress(place) || null;
    const contacts = contactsFromArticlePlace({ ...place, address, mapUrl: place.googleMapsUri });
    return [[place.id, {
      id: place.id,
      title: place.title,
      href,
      imageUrl: place.images[0]?.url ?? null,
      description: place.shortDesc.trim() || null,
      address,
      contacts,
      price: sharedPriceFromPublication(place),
      openingHours: place.openingHours ? openingHoursFromRelational(place.openingHours) : null,
      embedCard: embedById.get(place.id) ?? null,
    } satisfies ResolvedArticlePlace] as const];
  }));
}

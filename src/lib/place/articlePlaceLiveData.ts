import "server-only";

import prisma from "@/lib/prisma";
import { contactsFromPlace, type SharedContactsData } from "@/domain/contacts/structuredContacts";
import { sharedPriceFromPublication, type SharedPriceData } from "@/domain/pricing/structuredPrice";
import { openingHoursFromRelational, type SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { getPlacePublicPath } from "@/lib/placePublicUrl";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import type { ArticlePlaceSections } from "@/lib/publications/articleMvp";

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
};

export type ResolvedArticlePlaceCard = {
  kind: "place-live";
  place: ResolvedArticlePlace;
  sections: ArticlePlaceSections;
};

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

  return new Map(places.flatMap((place) => {
    const href = getPlacePublicPath({ id: place.id, slug: place.slug, citySlug: place.city?.slug });
    if (!href) return [];
    const address = formatMarketplaceHeroAddress(place) || null;
    const contacts = contactsFromPlace({ ...place, address, mapUrl: place.googleMapsUri });
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
    } satisfies ResolvedArticlePlace] as const];
  }));
}

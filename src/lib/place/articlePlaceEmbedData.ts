import "server-only";

import prisma from "@/lib/prisma";
import type { OfferProductType } from "@prisma/client";
import {
  getPublicPublishedPlaceWhere,
  getPublicPublishedOfferWhere,
} from "@/server/public/publicContentVisibility";
import { getPlaceRatingSummary } from "@/lib/place/placeRatingSummary";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { loadUpcomingPlaceEvents } from "@/lib/place/loadUpcomingPlaceEvents";
import { getOpeningStatus } from "@/server/services/openingHours/openingHours.service";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { generateSummary, mapToUIState } from "@/lib/openingHours/openingHoursMapper";
import { parsePriceData, type PriceData } from "@/lib/priceItems";
import { formatAgeRange } from "@/lib/offer/offerPageFormat";
import {
  formatPrice as formatBelarusPrice,
  formatPriceFrom as formatBelarusPriceFrom,
} from "@/lib/formatters/format-price";
import {
  stripHtml,
  extractDiscountsFromPromotionDetails,
  resolvePromotionText,
} from "@/lib/offer/offerPageData";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";

const GENITIVE_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function buildGoogleMapsUrl(lat: number | null, lng: number | null, address: string | null): string | null {
  if (lat != null && lng != null) return `https://maps.google.com/?q=${lat},${lng}`;
  if (address?.trim()) return `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`;
  return null;
}

export type ArticlePlaceAfishaItem = {
  id: string;
  href: string;
  title: string;
  imageUrl: string | null;
  categoryLabel: string | null;
  day: string | null;
  month: string | null;
  meta: string | null;
  priceLabel: string | null;
};

export type ArticlePlaceListItem = {
  id: string;
  href: string;
  title: string;
  meta: string | null;
  priceLabel: string | null;
  tag?: string | null;
};

/**
 * Legacy shallow shape kept for `BreakingNewsView` (its `PriceSection` and
 * `LinkedEntityCard` widgets), which resolved PLACE `activityCard` blocks
 * before this richer embed existed. Populated alongside the new card below
 * so that consumer keeps working unchanged.
 */
export type PlaceCardExtra = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  cityName: string | null;
  openingHoursSummary: string | null;
  ageTags: string[];
  activityTypes: string[];
  createdAt: Date;
  priceData: PriceData;
  priceUpdatedAt: Date;
};

export type ResolvedPlaceEmbedCard = {
  kind: "place-embed";
  placeId: string;
  slug: string;
  href: string;
  title: string;
  categoryLabel: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  coverImageCount: number;
  rating: { value: number; count: number } | null;
  isOpenNow: boolean | null;
  hoursMessage: string | null;
  metroName: string | null;
  ageTags: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  updatedAt: string;
  tabs: {
    afisha: ArticlePlaceAfishaItem[];
    visit: ArticlePlaceListItem[];
    party: ArticlePlaceListItem[];
    promo: ArticlePlaceListItem[];
  };
  /** @see PlaceCardExtra */
  placeExtra: PlaceCardExtra;
};

const PARTY_PRODUCT_TYPES: OfferProductType[] = ["PARTY_SERVICE", "PARTY_PACKAGE"];

/**
 * Full data for the "place embedded in an article" block, by placeId.
 * Every field is sourced from the same models/visibility rules as the real
 * place page (`src/app/(public)/[city]/places/[slug]/page.tsx`) and the
 * public Offer page (`src/lib/offer/offerPageData.ts`) — no invented fields,
 * no mock data. Returns `null` when the place isn't publicly visible, or has
 * nothing live to show in any of the four tabs (by design: an empty block
 * must not render at all).
 */
export async function getArticlePlaceEmbedData(placeId: string): Promise<ResolvedPlaceEmbedCard | null> {
  const place = await prisma.place.findFirst({
    where: { AND: [{ id: placeId }, getPublicPublishedPlaceWhere()] },
    select: {
      id: true,
      title: true,
      slug: true,
      lat: true,
      lng: true,
      formattedAddr: true,
      customAddress: true,
      shortAddress: true,
      floor: true,
      unit: true,
      unitLabel: true,
      ageTags: true,
      activityTypes: true,
      logoImageId: true,
      googleRating: true,
      googleUserRatingsTotal: true,
      createdAt: true,
      updatedAt: true,
      priceItems: true,
      category: true,
      city: { select: { slug: true, name: true } },
      metroAuto: { select: { name: true } },
      metroManual: { select: { name: true } },
      primaryCategory: { select: { nameRu: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, kind: true },
      },
      openingHours: {
        include: {
          rules: { include: { intervals: true } },
          exceptions: { include: { intervals: true } },
        },
      },
    },
  });
  if (!place) return null;

  const citySlug = place.city?.slug ?? "minsk";
  const href = buildCityPublicPath({ citySlug, type: "place", slug: place.slug ?? place.id });

  const galleryImages = place.images.filter((image) => image.kind === "GALLERY");

  const [rating, logoUrl, upcomingEvents, offers] = await Promise.all([
    getPlaceRatingSummary(place.id, {
      googleRating: place.googleRating,
      googleUserRatingsTotal: place.googleUserRatingsTotal,
    }),
    resolvePlaceLogoUrlFromDb(place.images, place.logoImageId),
    loadUpcomingPlaceEvents({ placeId: place.id, cityId: null, take: 12 }),
    prisma.offer.findMany({
      where: { AND: [{ placeId: place.id }, getPublicPublishedOfferWhere()] },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        priceCaption: true,
        priceFrom: true,
        priceText: true,
        productType: true,
        promotionalOffer: true,
        promoTitle: true,
        promoUntil: true,
        promotionDetails: true,
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const isOpenNow = place.openingHours
    ? getOpeningStatus(place.openingHours as OpeningHoursWithRelations, new Date())
    : null;
  const openingHoursSummary = place.openingHours
    ? generateSummary(mapToUIState(place.openingHours as OpeningHoursWithRelations))
        .split("\n")[0]
        ?.trim() || null
    : null;

  const address =
    formatMarketplaceHeroAddress({
      city: place.city,
      shortAddress: place.shortAddress,
      formattedAddr: place.formattedAddr,
      customAddress: place.customAddress,
      floor: place.floor,
      unit: place.unit,
      unitLabel: place.unitLabel,
    }) ||
    place.formattedAddr?.trim() ||
    place.customAddress?.trim() ||
    null;

  const afisha: ArticlePlaceAfishaItem[] = upcomingEvents.map((event) => {
    const when = event.sessions[0]?.startsAt ?? event.nextOccurrenceAt ?? null;
    const ageLabel = formatAgeRange(event.ageMinMonths, event.ageMaxMonths);
    const weekday = when ? when.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "") : null;
    const time = when ? when.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : null;
    const priceLabel =
      event.priceText?.trim() ||
      (event.priceFrom != null ? formatBelarusPrice(event.priceFrom) : null) ||
      (event.priceMode === "FREE" ? formatBelarusPrice(0) : null);
    return {
      id: event.id,
      href: `/${citySlug}/events/${event.slug ?? event.id}`,
      title: event.title,
      imageUrl: event.coverImageUrl ?? event.images[0]?.url ?? null,
      categoryLabel: event.eventCategory?.nameRu ?? null,
      day: when ? String(when.getDate()) : null,
      month: when ? GENITIVE_MONTHS[when.getMonth()] : null,
      meta: weekday && time ? `${weekday}, ${time}${ageLabel !== "Любой возраст" ? ` · ${ageLabel}` : ""}` : null,
      priceLabel,
    };
  });

  const visit: ArticlePlaceListItem[] = offers
    .filter((o) => o.productType === "PLACE_VISIT")
    .map((o) => offerToListItem(o, citySlug));

  const party: ArticlePlaceListItem[] = offers
    .filter((o) => o.productType != null && PARTY_PRODUCT_TYPES.includes(o.productType))
    .map((o) => offerToListItem(o, citySlug));

  const promo: ArticlePlaceListItem[] = offers
    .map((o) => {
      const discounts = extractDiscountsFromPromotionDetails(o.promotionDetails);
      const promoText = resolvePromotionText({
        promoTitle: o.promoTitle,
        promotionalOffer: o.promotionalOffer,
        hasDiscounts: discounts.length > 0,
      });
      const isActive = o.promoUntil == null || o.promoUntil.getTime() >= Date.now();
      if (!isActive) return null;
      const primaryDiscount: { rate: string; label: string } | undefined = discounts[0];
      const title = primaryDiscount?.label || promoText || null;
      if (!title) return null;
      const item: ArticlePlaceListItem = {
        id: o.id,
        href: o.slug ? getOfferPublicPath({ slug: o.slug }, citySlug) : href,
        title,
        meta: o.promoUntil ? `до ${o.promoUntil.toLocaleDateString("ru-RU")}` : null,
        priceLabel: primaryDiscount?.rate ?? null,
      };
      return item;
    })
    .filter((item): item is ArticlePlaceListItem => item != null);

  const hasAnything =
    afisha.length > 0 || visit.length > 0 || party.length > 0 || promo.length > 0;
  if (!hasAnything) return null;

  return {
    kind: "place-embed",
    placeId: place.id,
    slug: place.slug ?? place.id,
    href,
    title: place.title,
    categoryLabel: place.primaryCategory?.nameRu?.trim() || place.category?.trim() || null,
    logoUrl: logoUrl ?? null,
    coverImageUrl: galleryImages[0]?.url ?? null,
    coverImageCount: galleryImages.length,
    rating,
    isOpenNow: isOpenNow?.isOpen ?? null,
    hoursMessage: isOpenNow?.message ?? null,
    metroName: place.metroManual?.name || place.metroAuto?.name || null,
    ageTags: place.ageTags,
    address,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    mapsUrl: buildGoogleMapsUrl(place.lat, place.lng, address),
    updatedAt: place.updatedAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    tabs: { afisha, visit, party, promo },
    placeExtra: {
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      address,
      cityName: place.city?.name ?? null,
      openingHoursSummary,
      ageTags: place.ageTags,
      activityTypes: place.activityTypes,
      createdAt: place.createdAt,
      priceData: parsePriceData(place.priceItems),
      priceUpdatedAt: place.updatedAt,
    },
  };
}

function offerToListItem(
  offer: {
    id: string;
    slug: string | null;
    title: string;
    description: string | null;
    priceCaption: string | null;
    priceFrom: number | null;
    priceText: string | null;
  },
  citySlug: string,
): ArticlePlaceListItem {
  const meta =
    stripHtml(offer.priceCaption) ||
    (offer.description ? truncate(stripHtml(offer.description), 110) : "") ||
    null;
  const priceLabel =
    offer.priceText?.trim() ||
    (offer.priceFrom != null ? formatBelarusPriceFrom(offer.priceFrom) : null);
  return {
    id: offer.id,
    href: offer.slug ? getOfferPublicPath({ slug: offer.slug }, citySlug) : "#",
    title: offer.title,
    meta,
    priceLabel,
  };
}

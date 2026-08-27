import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { OfferPageData, OfferType, OfferCtaType, OfferGalleryImage, OfferScheduleItem } from "./offerPageTypes";
import { formatAgeRange, formatPrice } from "./offerPageFormat";
import {
  BELARUS_CURRENCY_SYMBOL,
  formatPriceAmount,
  normalizeUiCurrencyText,
} from "@/lib/formatters/format-price";
import { getMinCampSessionPrice, parseCampSessionPrice } from "@/lib/offers/campPricing";
import { CAMP_OFFER_DISCOVERY_GROUP_SLUGS } from "@/lib/offers/campOfferDiscoverySignals";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { isGoogleReviewsEnabled } from "@/lib/place/googleReviewsMeta";
import { getNormalizedPhones } from "@/lib/phones/normalizePhones";
import { getNormalizedOfferPhones } from "@/lib/offer/offerPhones";
import { getNormalizedPlacePhones } from "@/lib/place/placePhones";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { resolveCanonicalCta } from "@/lib/cta-platform";

interface GetOfferPageDataParams {
  citySlug: string;
  /** @deprecated unused — section is not part of Offer identity, see BACKLOG-116. Kept optional for old callers. */
  section?: string;
  slug: string;
}

const offerPageInclude = {
  place: {
    include: {
      city: true,
      districtManual: true,
      districtAuto: true,
      metroManual: true,
      metroAuto: true,
      images: {
        select: { id: true, url: true, kind: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
} as const;

type OfferWithPageRelations = Prisma.OfferGetPayload<{
  include: typeof offerPageInclude;
}>;

type CampSessionJson = {
  id?: string;
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  priceOverride?: number | string;
  description?: string;
  promotionDetails?: string;
  ageFrom?: number;
  ageTo?: number;
  spotsLeft?: number;
  capacity?: number;
};

function isCampSessionJson(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatCampSessionAgeRange(
  ageFrom?: number,
  ageTo?: number,
): string | undefined {
  if (ageFrom == null && ageTo == null) return undefined;
  if (ageFrom != null && ageTo != null) return `${ageFrom}–${ageTo} лет`;
  if (ageFrom != null) return `от ${ageFrom} лет`;
  return `до ${ageTo} лет`;
}

function parseCampSession(value: Prisma.JsonValue, index: number): OfferScheduleItem | null {
  if (!isCampSessionJson(value)) return null;

  const session = value as CampSessionJson;
  const dateFrom = asOptionalString(session.dateFrom);
  const dateTo = asOptionalString(session.dateTo);
  const ageFrom = asOptionalNumber(session.ageFrom);
  const ageTo = asOptionalNumber(session.ageTo);
  const priceOverride = parseCampSessionPrice(session.priceOverride) ?? undefined;

  return {
    id: asOptionalString(session.id) ?? `camp-session-${index}`,
    title: asOptionalString(session.title),
    dateFrom: dateFrom
      ? new Date(dateFrom).toLocaleDateString("ru-RU")
      : undefined,
    dateTo: dateTo ? new Date(dateTo).toLocaleDateString("ru-RU") : undefined,
    price: priceOverride != null ? formatPrice(priceOverride) : undefined,
    description: asOptionalString(stripHtml(session.description)),
    promotionDetails: asOptionalString(stripHtml(session.promotionDetails)),
    ageRange: formatCampSessionAgeRange(ageFrom, ageTo),
    spotsLeft: asOptionalNumber(session.spotsLeft),
    capacity: asOptionalNumber(session.capacity),
    ctaEnabled: true,
  };
}

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDiscountsFromPromotionDetails(html?: string | null): Array<{ rate: string; label: string }> {
  if (!html) return [];

  const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  const rawItems =
    liMatches.length > 0
      ? liMatches.map((match) => stripHtml(match[1]))
      : stripHtml(html)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

  return rawItems
    .map((item) => {
      const rateMatch = item.match(/(-?\d{1,2}%)/);
      if (!rateMatch) return null;
      const rate = rateMatch[1];
      const label = item.replace(rateMatch[0], "").replace(/^[-:•\s]+/, "").trim();
      if (!label) return null;
      return { rate, label };
    })
    .filter((item): item is { rate: string; label: string } => Boolean(item));
}

function extractPromoPercent(...values: Array<string | null | undefined>): number | null {
  for (const value of values) {
    const plain = stripHtml(value);
    const match = plain.match(/(\d{1,2})\s*%/);
    if (match) return Number(match[1]);
  }
  return null;
}

function formatOldPriceFromPercent(priceFrom: number | null | undefined, percent: number | null): string | undefined {
  if (!priceFrom || !percent || percent <= 0 || percent >= 100) return undefined;
  const oldPrice = priceFrom / (1 - percent / 100);
  return formatPrice(Math.round(oldPrice));
}

function resolvePriceUnit(args: {
  offerType: OfferType;
  plainPriceCaption: string;
}): string | undefined {
  const cleanedCaption = args.plainPriceCaption
    .replace(/^за\s+/i, "")
    .replace(/^\/\s*/i, "")
    .trim();

  if (cleanedCaption && cleanedCaption.length <= 18) {
    return `${BELARUS_CURRENCY_SYMBOL} / ${cleanedCaption}`;
  }

  if (args.offerType === "CAMP") {
    return `${BELARUS_CURRENCY_SYMBOL} / смена`;
  }

  return BELARUS_CURRENCY_SYMBOL;
}

export function resolvePromotionText(args: {
  promoTitle?: string | null;
  promotionalOffer?: string | null;
  hasDiscounts: boolean;
}): string | undefined {
  const promoTitle = args.promoTitle?.trim();
  if (promoTitle) return promoTitle;

  const promotionalOffer = stripHtml(args.promotionalOffer);
  if (!promotionalOffer) return undefined;
  if (args.hasDiscounts) return undefined;
  if (promotionalOffer.length > 42) return undefined;

  return promotionalOffer;
}

/**
 * Production data mapper for Offer Page.
 * Fetches data from Prisma and maps it to OfferPageData interface.
 */
export async function getOfferPageData({
  citySlug,
  section,
  slug,
}: GetOfferPageDataParams): Promise<OfferPageData | null> {
  void section;
  // 1. Fetch offer with all related data
  // Note: Offer unique constraint is @@unique([cityId, slug]), so findUnique({ where: { slug } })
  // is invalid. Use findFirst to look up by slug across cityId values (including null).
  const offer = await prisma.offer.findFirst({
    where: {
      AND: [
        { slug },
        getPublicPublishedOfferWhere(),
      ],
    },
    include: offerPageInclude,
  });

  // Note: place.phone and place.website are available via the include above

  if (!offer) {
    return null;
  }

  return buildOfferPageDataFromOffer(offer, citySlug);
}

export async function getOfferPreviewPageDataById(
  id: string,
): Promise<{ offer: OfferWithPageRelations; data: OfferPageData } | null> {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: offerPageInclude,
  });

  if (!offer) {
    return null;
  }

  const data = await buildOfferPageDataFromOffer(
    offer,
    offer.place?.city?.slug ?? "minsk",
  );

  return { offer, data };
}

async function buildOfferPageDataFromOffer(
  offer: OfferWithPageRelations,
  citySlug: string,
): Promise<OfferPageData> {

  const placeLogoUrl = offer.place
    ? await resolvePlaceLogoUrlFromDb(offer.place.images, offer.place.logoImageId)
    : undefined;

  // 2. Fetch reviews from PlaceReview (only MAMAGO source). No Place yet
  // (unassigned DRAFT) means no reviews to show.
  const reviews = offer.placeId
    ? await prisma.placeReview.findMany({
        where: {
          placeId: offer.placeId,
          source: "MAMAGO",
        },
        orderBy: { publishedAt: "desc" },
        take: 12,
        select: {
          id: true,
          authorName: true,
          authorAvatarUrl: true,
          rating: true,
          text: true,
          publishedAt: true,
          relativeTimeDescription: true,
        },
      })
    : [];

  const selectedCampCharacteristics =
    offer.campProgramType && offer.discoverySignalIds.length > 0
      ? await prisma.signalDefinition.findMany({
          where: {
            id: { in: offer.discoverySignalIds },
            parent: {
              slug: { in: CAMP_OFFER_DISCOVERY_GROUP_SLUGS },
            },
          },
          select: {
            id: true,
            title: true,
            order: true,
            parent: {
              select: {
                slug: true,
                title: true,
                order: true,
              },
            },
          },
          orderBy: [{ parent: { order: "asc" } }, { order: "asc" }],
        })
      : [];

  // 3. Map to OfferPageData
  
  // Determine offer type
  let offerType: OfferType = "SINGLE";
  if (offer.campProgramType) offerType = "CAMP";
  else if (offer.kind === "SERVICE") offerType = "REGULAR";

  // Map gallery
  const gallery: OfferGalleryImage[] = (offer.galleryImages as string[] || []).map((url: string, idx: number) => ({
    id: `gallery-${idx}`,
    url,
    alt: offer.title,
  }));

  // Map schedule items
  const campSessionsRaw = Array.isArray(offer.campSessions) ? offer.campSessions : [];
  const derivedCampPriceFrom =
    offerType === "CAMP" ? getMinCampSessionPrice(campSessionsRaw) : null;
  const effectivePriceFrom =
    offerType === "CAMP" ? derivedCampPriceFrom : offer.priceFrom;
  const fallbackShiftPrice = effectivePriceFrom != null
    ? formatPrice(effectivePriceFrom)
    : undefined;
  const scheduleItems: OfferScheduleItem[] = campSessionsRaw
    .map((session, index) => parseCampSession(session, index))
    .filter((session): session is OfferScheduleItem => session !== null)
    .map((item) => ({ ...item, price: item.price ?? fallbackShiftPrice }));

  // Map pricing
  const pricingMode = effectivePriceFrom != null ? "single" : "multiple";
  const plainPriceCaption =
    offerType === "CAMP" ? "" : stripHtml(offer.priceCaption);
  const parsedDiscounts =
    offerType === "CAMP"
      ? []
      : extractDiscountsFromPromotionDetails(offer.promotionDetails);
  const promoPercent =
    offerType === "CAMP"
      ? null
      : extractPromoPercent(
          offer.promoTitle,
          offer.promotionalOffer,
          offer.promotionDetails,
        );
  const inferredOldPrice = formatOldPriceFromPercent(effectivePriceFrom, promoPercent);
  const promotionText =
    offerType === "CAMP"
      ? undefined
      : resolvePromotionText({
          promoTitle: offer.promoTitle,
          promotionalOffer: offer.promotionalOffer,
          hasDiscounts: parsedDiscounts.length > 0,
        });
  
  // Map meta grid
  const metaGrid = [
    { id: "age", label: "Возраст", value: formatAgeRange(offer.ageMinMonths, offer.ageMaxMonths) },
    { id: "format", label: "Формат", value: offer.campProgramType || (offer.kind === "SERVICE" ? "Групповые занятия" : "Услуга") },
  ];
  
  // Add duration if available
  if (offer.campSessionDuration) {
    metaGrid.push({ id: "duration", label: "Длительность", value: offer.campSessionDuration });
  }
  
  // Add period if dates available
  if (offer.dateFrom && offer.dateTo) {
    const from = new Date(offer.dateFrom).toLocaleDateString("ru-RU", { month: "long" });
    const to = new Date(offer.dateTo).toLocaleDateString("ru-RU", { month: "long" });
    metaGrid.push({ id: "period", label: "Период", value: `${from} — ${to}` });
  }
  
  // Add group size if available
  if (offer.campGroupSize) {
    metaGrid.push({ id: "group", label: "Группа", value: `До ${offer.campGroupSize} человек` });
  }

  // Map CTA based on bookingMode or kind
  let ctaType: OfferCtaType = "отправить_заявку";
  let primaryLabel = "Оставить заявку";
  
  if (offer.bookingEnabled && offer.bookingMode) {
    switch (offer.bookingMode) {
      case "REQUEST_ONLY":
        ctaType = "записаться";
        primaryLabel = "Записаться";
        break;
      case "USE_PUBLICATION_DATES":
      case "USE_PUBLICATION_SLOTS":
        ctaType = "забронировать";
        primaryLabel = "Забронировать";
        break;
    }
  } else if (offerType === "CAMP") {
    // Для лагерей всегда "Записаться", не "Забронировать"
    ctaType = "записаться";
    primaryLabel = "Записаться";
  } else if (offer.kind === "SERVICE") {
    ctaType = "записаться";
    primaryLabel = "Записаться";
  }

  const cta = (() => {
    const phones = offer.bookingPhone
      ? getNormalizedPhones({ phone: offer.bookingPhone })
      : (() => {
          const ownPhones = getNormalizedOfferPhones(offer);
          return ownPhones.length > 0
            ? ownPhones
            : offer.place
              ? getNormalizedPlacePhones(offer.place)
              : [];
        })();

    return {
      type: ctaType,
      primaryLabel,
      secondaryLabel: "В план",
      phone: phones[0]?.value,
      phones,
      link: offer.contactWebsite || offer.place?.website || undefined,
      instructions: offer.bookingNote || undefined,
    };
  })();

  return {
    id: offer.id,
    slug: offer.slug || "",
    citySlug: citySlug,
    title: offer.title,
    shortDescription: offer.description?.substring(0, 160).replace(/<[^>]*>/g, "") || "",
    description: offer.description || "",
    offerType,
    
    media: {
      posterUrl: offer.coverImage || "",
      posterAlt: offer.title,
      gallery,
      videoUrl: offer.videoUrl ?? undefined,
      videoLabel: "Трейлер",
    },
    
    metaGrid,
    
    pricing: {
      mode: pricingMode,
      singlePrice: effectivePriceFrom != null ? formatPrice(effectivePriceFrom) : undefined,
      priceCaption:
        offerType === "CAMP"
          ? undefined
          : normalizeUiCurrencyText(offer.priceCaption || undefined) || undefined,
      priceDisplay:
        effectivePriceFrom != null ? formatPriceAmount(effectivePriceFrom) : undefined,
      priceUnit: resolvePriceUnit({
        offerType,
        plainPriceCaption,
      }),
      priceFrom:
        offerType === "CAMP" && effectivePriceFrom == null
          ? "Цена зависит от смены"
          : effectivePriceFrom != null
            ? formatPrice(effectivePriceFrom)
            : undefined,
      promotionText,
      promoTitle: offerType === "CAMP" ? undefined : offer.promoTitle || undefined,
      promoUntil: offer.promoUntil ? offer.promoUntil.toISOString() : undefined,
      promotionDetails:
        offerType === "CAMP" ? undefined : offer.promotionDetails || undefined,
      discounts: parsedDiscounts.length > 0 ? parsedDiscounts : undefined,
      oldPrice: inferredOldPrice,
    },
    
    schedule: offerType !== "SINGLE" ? {
      type: offerType === "CAMP" ? "shifts" : "classes",
      items: scheduleItems,
    } : undefined,

    accommodation: offerType === "CAMP" ? {
      provided: !!offer.accommodationProvided,
      type: offer.accommodationType || undefined,
      address: offer.accommodationAddress || undefined,
      rooms: offer.accommodationRooms || undefined,
      conditions: offer.accommodationConditions || undefined,
      mealInfo: offer.mealInfo || undefined,
      transferInfo: offer.transferInfo || undefined,
      whatToBring: offer.whatToBring || undefined,
      safetyInfo: offer.campSafetyInfo || undefined,
      medicalInfo: offer.campMedicalInfo || undefined,
    } : undefined,

    place: offer.place ? {
      id: offer.place.id,
      name: offer.place.title,
      slug: offer.place.slug || "",
      address: offer.place.customAddress || offer.place.formattedAddr || "",
      district: offer.place.districtManual?.name || offer.place.districtAuto?.name,
      metro: offer.place.metroManual?.name || offer.place.metroAuto?.name,
      lat: offer.place.lat || undefined,
      lng: offer.place.lng || undefined,
      logoUrl: placeLogoUrl,
      rating: isGoogleReviewsEnabled(offer.place.googlePlaceId, offer.place.googleReviewsJson)
        ? (offer.place.googleRating || undefined)
        : undefined,
      ratingsCount: isGoogleReviewsEnabled(offer.place.googlePlaceId, offer.place.googleReviewsJson)
        ? (offer.place.googleUserRatingsTotal || undefined)
        : undefined,
    } : undefined,

    reviews: reviews.map(r => ({
      id: r.id,
      authorName: r.authorName,
      authorAvatar: r.authorAvatarUrl || undefined,
      rating: r.rating,
      text: r.text || "",
      date: r.relativeTimeDescription || new Date(r.publishedAt!).toLocaleDateString("ru-RU", { 
        day: "numeric", 
        month: "long", 
        year: "numeric" 
      }),
    })),
    faqItems: normalizeFaqItems(offer.faqItems),
    reviewsCount: reviews.length,
    averageRating: reviews.length > 0 
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
      : undefined,
    perks:
      offerType === "CAMP" && selectedCampCharacteristics.length > 0
        ? selectedCampCharacteristics.slice(0, 5).map((signal) => ({
            label: signal.parent?.title ?? "Характеристика",
            stat: signal.title,
          }))
        : undefined,
    cta,
    resolvedCta: resolveCanonicalCta({
      entityType: "OFFER",
      entity: {
        id: offer.id,
        ctaType: cta.type,
        ctaPhone: cta.phone,
        ctaLink: cta.link,
        ctaInstructions: cta.instructions,
        bookingEnabled: offer.bookingEnabled,
        bookingMode: offer.bookingMode,
        bookingPhone: offer.bookingPhone,
        bookingNote: offer.bookingNote,
      },
    }),

    similar: [], // Will be implemented later
    
    seo: {
      title: offer.seoTitle || undefined,
      description: offer.seoDescription || undefined,
      ogImage: offer.seoOgImage || undefined,
      canonicalUrl: offer.seoCanonicalUrl || undefined,
    },
  };
}

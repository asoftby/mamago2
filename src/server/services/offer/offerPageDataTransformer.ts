import type { Prisma } from "@prisma/client";
import type {
  OfferPageData,
  OfferType,
  OfferCtaType,
  OfferGalleryImage,
  OfferMetaItem,
} from "@/lib/offer/offerPageTypes";
import { getProgramTypeLabel } from "@/lib/public/publicVerticalResolver";

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    place: {
      select: {
        id: true;
        title: true;
        slug: true;
        formattedAddr: true;
        customAddress: true;
        shortAddress: true;
        lat: true;
        lng: true;
        districtManual: { select: { name: true } };
        districtAuto: { select: { name: true } };
        metroManual: { select: { name: true } };
        metroAuto: { select: { name: true } };
      };
    };
    images: {
      select: {
        id: true;
        url: true;
        width: true;
        height: true;
        blurhash: true;
      };
    };
    coverImage: {
      select: {
        id: true;
        publicUrl: true;
        width: true;
        height: true;
      };
    };
  };
}>;

/**
 * Transform Activity from database into OfferPageData for rendering.
 * Handles CAMP, REGULAR, and SINGLE offer types.
 */
export async function transformActivityToOfferPageData(
  activity: ActivityWithRelations,
  citySlug: string,
): Promise<OfferPageData> {
  // Determine offer type from activity data
  const offerType = determineOfferType(activity);

  // Build media
  const posterUrl =
    activity.coverImage?.publicUrl ||
    activity.coverImageUrl ||
    activity.images[0]?.url ||
    "";
  const gallery: OfferGalleryImage[] = activity.images.map((img) => ({
    id: img.id,
    url: img.url,
    width: img.width || undefined,
    height: img.height || undefined,
    blurhash: img.blurhash || undefined,
    alt: activity.title,
  }));

  // Build meta grid (age, format, duration, etc.)
  const metaGrid = buildMetaGrid(activity, offerType);

  // Build pricing
  const pricing = buildPricing(activity);

  // Build schedule (for REGULAR and CAMP)
  const schedule = buildSchedule(activity, offerType);

  // Build accommodation (for CAMP only)
  const accommodation = offerType === "CAMP" ? buildAccommodation(activity) : undefined;

  // Build place data
  const place = activity.place
    ? {
        id: activity.place.id,
        name: activity.place.title,
        slug: activity.place.slug || activity.place.id,
        address:
          activity.place.formattedAddr ||
          activity.place.customAddress ||
          activity.place.shortAddress ||
          undefined,
        district:
          activity.place.districtManual?.name ||
          activity.place.districtAuto?.name ||
          undefined,
        metro:
          activity.place.metroManual?.name || activity.place.metroAuto?.name || undefined,
        lat: activity.place.lat || undefined,
        lng: activity.place.lng || undefined,
      }
    : undefined;

  // Build CTA
  const cta = buildCta(activity);

  // SEO
  const seo = {
    title: activity.seoTitle || undefined,
    description: activity.seoDescription || undefined,
    ogTitle: activity.seoOgTitle || undefined,
    ogDescription: activity.seoOgDescription || undefined,
    ogImage: activity.seoOgImage || posterUrl || undefined,
    canonicalUrl: activity.seoCanonicalUrl || undefined,
  };

  return {
    id: activity.id,
    slug: activity.slug || activity.id,
    citySlug,
    title: activity.title,
    shortDescription: activity.shortDesc,
    description: activity.description || activity.shortDesc,
    offerType,
    media: {
      posterUrl,
      posterAlt: activity.title,
      gallery,
      videoUrl: null, // TODO: Add video support when field is added to Activity
      videoThumbnail: null,
      videoDuration: null,
      videoLabel: null,
    },
    metaGrid,
    pricing,
    schedule,
    accommodation,
    place,
    reviews: [], // TODO: Fetch reviews from ActivityReview table
    reviewsCount: 0,
    averageRating: undefined,
    cta,
    similar: [], // TODO: Fetch similar programs
    seo,
    previewBannerLabel: activity.status === "DRAFT" ? "Черновик" : undefined,
    hidePublicationStats: false,
    discoveryIntent: undefined, // TODO: Resolve from activity category
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function determineOfferType(_activity: ActivityWithRelations): OfferType {
  // Try to infer from scheduleJson or other fields
  // For now, default to REGULAR
  // TODO: Add offerWizardType field to Activity model
  return "REGULAR";
}

function buildMetaGrid(
  activity: ActivityWithRelations,
  offerType: OfferType,
): OfferMetaItem[] {
  const items: OfferMetaItem[] = [];

  // Age
  if (activity.ageLabel) {
    items.push({
      id: "age",
      icon: "👶",
      label: "Возраст",
      value: activity.ageLabel,
    });
  }

  // Format (online/offline)
  if (activity.format) {
    items.push({
      id: "format",
      icon: "📍",
      label: "Формат",
      value: activity.format === "OFFLINE" ? "Офлайн" : "Онлайн",
    });
  }

  // Type label
  const typeLabel = getProgramTypeLabel(null); // TODO: Pass actual offerWizardType
  items.push({
    id: "type",
    icon: offerType === "CAMP" ? "🏕️" : "📚",
    label: "Тип",
    value: typeLabel,
  });

  return items;
}

function buildPricing(activity: ActivityWithRelations) {
  if (activity.priceFrom && activity.priceTo && activity.priceFrom !== activity.priceTo) {
    return {
      mode: "single" as const,
      singlePrice: undefined,
      singleCurrency: activity.currency || "BYN",
      priceCaption: undefined,
      priceFrom: `${activity.priceFrom} ${activity.currency || "BYN"}`,
      options: undefined,
      promotionText: undefined,
      promotionSubtitle: undefined,
    };
  }

  if (activity.priceFrom) {
    return {
      mode: "single" as const,
      singlePrice: `${activity.priceFrom}`,
      singleCurrency: activity.currency || "BYN",
      priceCaption: activity.priceText || undefined,
      priceFrom: undefined,
      options: undefined,
      promotionText: undefined,
      promotionSubtitle: undefined,
    };
  }

  return {
    mode: "single" as const,
    singlePrice: undefined,
    singleCurrency: "BYN",
    priceCaption: "Уточняйте",
    priceFrom: undefined,
    options: undefined,
    promotionText: undefined,
    promotionSubtitle: undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildSchedule(_activity: ActivityWithRelations, _offerType: OfferType) {
  // TODO: Parse scheduleJson and transform to OfferScheduleItem[]
  // For now, return undefined
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildAccommodation(_activity: ActivityWithRelations) {
  // TODO: Parse accommodation data from Activity fields
  // For now, return basic structure
  return {
    provided: false,
    type: undefined,
    address: undefined,
    rooms: undefined,
    conditions: undefined,
    meals: undefined,
    mealInfo: undefined,
    transferInfo: undefined,
    whatToBring: undefined,
    safetyInfo: undefined,
    medicalInfo: undefined,
  };
}

function buildCta(activity: ActivityWithRelations): {
  type: OfferCtaType;
  primaryLabel: string;
  secondaryLabel?: string;
  phone?: string;
  link?: string;
  instructions?: string;
} {
  // Default CTA based on booking settings
  if (activity.bookingEnabled) {
    return {
      type: "забронировать",
      primaryLabel: "Забронировать",
      secondaryLabel: "В план",
      phone: activity.bookingPhone || undefined,
      link: undefined,
      instructions: activity.bookingNote || undefined,
    };
  }

  return {
    type: "отправить_заявку",
    primaryLabel: "Записаться",
    secondaryLabel: "В план",
    phone: undefined,
    link: undefined,
    instructions: undefined,
  };
}

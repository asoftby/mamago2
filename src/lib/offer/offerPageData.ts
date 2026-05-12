import prisma from "@/lib/prisma";
import type { OfferPageData, OfferType, OfferCtaType, OfferGalleryImage, OfferScheduleItem } from "./offerPageTypes";
import { formatAgeRange, formatPrice } from "./offerPageFormat";
import { getOfferPublicSection } from "../offers/offerPublicUrl";

interface GetOfferPageDataParams {
  citySlug: string;
  section: string;
  slug: string;
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
  // 1. Fetch offer with all related data
  const offer = await prisma.offer.findUnique({
    where: { slug },
    include: {
      place: {
        include: {
          city: true,
          districtManual: true,
          districtAuto: true,
          metroManual: true,
          metroAuto: true,
        },
      },
    },
  });

  // Note: place.phone and place.website are available via the include above

  if (!offer || offer.status !== "PUBLISHED") {
    return null;
  }

  // 2. Fetch reviews from PlaceReview (only MAMAGO source)
  const reviews = await prisma.placeReview.findMany({
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
  });

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
  const scheduleItems: OfferScheduleItem[] = (campSessionsRaw as any[]).map((session: any) => ({
    id: session.id || Math.random().toString(36).substr(2, 9),
    title: session.title,
    dateFrom: session.dateFrom ? new Date(session.dateFrom).toLocaleDateString("ru-RU") : undefined,
    dateTo: session.dateTo ? new Date(session.dateTo).toLocaleDateString("ru-RU") : undefined,
    price: session.priceOverride ? `${session.priceOverride} BYN` : undefined,
    description: session.description,
    ageRange: session.ageFrom || session.ageTo ? `${session.ageFrom || ""}-${session.ageTo || ""}` : undefined,
    spotsLeft: session.spotsLeft,
    capacity: session.capacity,
    ctaEnabled: true,
  }));

  // Map pricing
  const pricingMode = offer.priceFrom ? "single" : "multiple";
  
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

  const data: OfferPageData = {
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
      videoUrl: offer.videoUrl,
      videoLabel: "Трейлер",
    },
    
    metaGrid,
    
    pricing: {
      mode: pricingMode as any,
      singlePrice: offer.priceFrom ? formatPrice(offer.priceFrom) : undefined,
      priceCaption: offer.priceCaption || undefined,
      promotionText: offer.promotionalOffer || undefined,
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
      address: offer.place.formattedAddr || offer.place.customAddress || "",
      district: offer.place.districtManual?.name || offer.place.districtAuto?.name,
      metro: offer.place.metroManual?.name || offer.place.metroAuto?.name,
      lat: offer.place.lat || undefined,
      lng: offer.place.lng || undefined,
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
    reviewsCount: reviews.length,
    averageRating: reviews.length > 0 
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
      : undefined,

    cta: {
      type: ctaType,
      primaryLabel,
      secondaryLabel: "В план",
      phone: offer.bookingPhone || offer.contactPhone || offer.place?.phone || undefined,
      link: offer.contactWebsite || offer.place?.website || undefined,
      instructions: offer.bookingNote || undefined,
    },

    similar: [], // Will be implemented later
    
    seo: {
      title: offer.seoTitle || undefined,
      description: offer.seoDescription || undefined,
      ogImage: offer.seoOgImage || undefined,
      canonicalUrl: offer.seoCanonicalUrl || undefined,
    },
  };

  return data;
}

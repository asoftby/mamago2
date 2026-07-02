import type { Place, PlaceImage as PrismaPlaceImage, Prisma } from "@prisma/client";
import type { PlaceFormData, PlaceImage } from "./types";
import { getDefaultFormData } from "./defaults";
import { mapToUIState } from "@/lib/openingHours";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { normalizeVisitFormats } from "@/hooks/useVisitFormats";
import { resolvePlaceLogoImage } from "@/lib/place/resolvePlaceLogoImage";
import { parsePriceData } from "@/lib/priceItems";
import { normalizePlacePhoneFields } from "@/lib/place/placePhones";
import { normalizeFaqItems } from "@/lib/faq/faqItems";

type PlaceWithRelations = Place & {
  images?: PrismaPlaceImage[];
  openingHours?: OpeningHoursWithRelations | null;
  subcategories?: Array<{ categoryId: string; position: number }>;
};

/**
 * Map Place entity from database to form data
 */
export function mapPlaceToFormData(
  place: PlaceWithRelations
): PlaceFormData {
  const defaults = getDefaultFormData();
  const phones = normalizePlacePhoneFields(place);
  
  return {
    ...defaults,
    
    // Identity
    id: place.id,
    createdByUserId: place.createdByUserId,
    ownerBusinessId: place.ownerBusinessId,
    status: place.status,
    
    // Step 1: Profile
    title: place.title,
    category: place.category,
    shortDesc: place.shortDesc,
    description: place.description,
    ageTags: place.ageTags || [],
    visitFormats: normalizeVisitFormats(place.visitFormats || []),
    primaryCategoryId: place.primaryCategoryId ?? null,
    subcategoryIds: place.subcategories
      ? [...place.subcategories]
          .sort((a, b) => a.position - b.position)
          .map((s) => s.categoryId)
      : [],
    
    // Step 2: Location
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId,
    formattedAddr: place.formattedAddr,
    addressJson: place.addressJson,
    customAddress: place.customAddress,
    cityId: place.cityId,
    districtAutoId: place.districtAutoId,
    districtManualId: place.districtManualId,
    metroAutoId: place.metroAutoId,
    metroAutoDistanceM: place.metroAutoDistanceM,
    metroManualId: place.metroManualId,
    metroManualDistanceM: place.metroManualDistanceM,
    
    // Google Reviews
    googleRating: place.googleRating,
    googleUserRatingsTotal: place.googleUserRatingsTotal,
    googleReviewsJson: place.googleReviewsJson,
    googleReviewsSyncedAt: place.googleReviewsSyncedAt,
    googleMapsUri: place.googleMapsUri,
    
    // Step 3: Contacts
    phone: phones.phone,
    phoneLabel: phones.phoneLabel,
    phone2: phones.phone2,
    phone2Label: phones.phone2Label,
    phone3: phones.phone3,
    phone3Label: phones.phone3Label,
    website: place.website,
    bookingEnabled: place.bookingEnabled,
    bookingPhone: place.bookingPhone,
    bookingNote: place.bookingNote,
    instagramHandle: place.instagramHandle,
    instagramUrl: place.instagramUrl,
    
    // Step 4: Photos
    logoImageId: place.logoImageId,
    logoUrl: resolvePlaceLogoImage(place.images ?? [], place.logoImageId)?.url ?? null,
    images: place.images ? place.images.map(mapPrismaImageToFormImage) : [],
    reelsUrl: place.reelsUrl,
    
    // Step 5: Opening Hours
    openingHoursId: place.openingHoursId,
    openingHoursData: place.openingHours ? mapToUIState(place.openingHours) : null,

    // Prices
    priceItems: parsePriceData(place.priceItems),
    faqItems: normalizeFaqItems(place.faqItems),

    // Hierarchy
    placeKind: place.placeKind,
    floor: place.floor,
    unit: place.unit,
    
    // Timestamps
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
  };
}

/**
 * Map form data to Place payload for API submission
 */
export function buildPlacePayload(data: PlaceFormData): Partial<Place> & { subcategoryIds?: string[] } {
  const phones = normalizePlacePhoneFields(data);

  return {
    // Step 1: Profile
    title: data.title,
    category: data.category,
    primaryCategoryId: data.primaryCategoryId,
    subcategoryIds: data.subcategoryIds, // Обрабатывается отдельно в API
    shortDesc: data.shortDesc,
    description: data.description,
    ageTags: data.ageTags,
    visitFormats: data.visitFormats,
    
    // Step 2: Location
    lat: data.lat,
    lng: data.lng,
    googlePlaceId: data.googlePlaceId,
    formattedAddr: data.formattedAddr,
    addressJson: data.addressJson as Prisma.JsonValue,
    customAddress: data.customAddress,
    cityId: data.cityId,
    districtAutoId: data.districtAutoId,
    districtManualId: data.districtManualId,
    metroAutoId: data.metroAutoId,
    metroAutoDistanceM: data.metroAutoDistanceM,
    metroManualId: data.metroManualId,
    metroManualDistanceM: data.metroManualDistanceM,
    googleRating: data.googleRating,
    googleUserRatingsTotal: data.googleUserRatingsTotal,
    googleReviewsJson: data.googleReviewsJson as Prisma.JsonValue,
    googleReviewsSyncedAt: data.googleReviewsSyncedAt,
    googleMapsUri: data.googleMapsUri,
    
    // Step 3: Contacts
    phone: phones.phone,
    phoneLabel: phones.phoneLabel,
    phone2: phones.phone2,
    phone2Label: phones.phone2Label,
    phone3: phones.phone3,
    phone3Label: phones.phone3Label,
    website: data.website,
    // Intentionally excluded: booking compatibility fields remain read-only
    // until the shared CTA step is connected to Place Wizard.
    instagramHandle: data.instagramHandle,
    instagramUrl: data.instagramUrl,
    
    // Step 4: Photos
    logoImageId: data.logoImageId,
    reelsUrl: data.reelsUrl,

    // Step 5: Opening Hours (handled separately via openingHoursData)
    // openingHoursId is set by backend after creating OpeningHours record

    priceItems: data.priceItems as unknown as Prisma.JsonValue,
    faqItems: normalizeFaqItems(data.faqItems) as unknown as Prisma.JsonValue,

    // Hierarchy
    placeKind: data.placeKind,
    floor: data.floor,
    unit: data.unit,
  };
}

/**
 * Helper: Map Prisma PlaceImage to form PlaceImage
 */
function mapPrismaImageToFormImage(image: PrismaPlaceImage): PlaceImage {
  return {
    id: image.id,
    url: image.url,
    width: image.width,
    height: image.height,
    blurhash: image.blurhash,
    kind: image.kind,
    sortOrder: image.sortOrder,
  };
}

/**
 * Extract only changed fields by comparing with original
 */
export function extractChanges(
  current: PlaceFormData,
  original: PlaceFormData
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const payload = buildPlacePayload(current);
  const originalPayload = buildPlacePayload(original);
  
  // Compare each field
  for (const key in payload) {
    const currentValue = payload[key as keyof typeof payload];
    const originalValue = originalPayload[key as keyof typeof originalPayload];
    
    // Deep comparison for arrays and objects
    if (JSON.stringify(currentValue) !== JSON.stringify(originalValue)) {
      (changes as Record<string, unknown>)[key] = currentValue;
    }
  }
  
  return changes;
}

import type { Place, PlaceImage as PrismaPlaceImage } from "@prisma/client";
import type { PlaceFormData, PlaceImage } from "./types";
import { getDefaultFormData } from "./defaults";
import { mapToUIState } from "@/lib/openingHours";

/**
 * Map Place entity from database to form data
 */
export function mapPlaceToFormData(
  place: Place & { images?: PrismaPlaceImage[]; openingHours?: any }
): PlaceFormData {
  const defaults = getDefaultFormData();
  
  return {
    ...defaults,
    
    // Identity
    id: place.id,
    ownerUserId: place.ownerUserId,
    status: place.status,
    
    // Step 1: Profile
    title: place.title,
    category: place.category,
    shortDesc: place.shortDesc,
    description: place.description,
    ageTags: place.ageTags || [],
    visitFormats: place.visitFormats || [],
    activityTypes: place.activityTypes || [],
    
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
    
    // Step 3: Contacts
    phone: place.phone,
    website: place.website,
    instagramHandle: place.instagramHandle,
    instagramUrl: place.instagramUrl,
    
    // Step 4: Photos
    logoImageId: place.logoImageId,
    logoUrl: place.logoUrl,
    images: place.images ? place.images.map(mapPrismaImageToFormImage) : [],
    
    // Step 5: Opening Hours
    openingHoursId: place.openingHoursId,
    openingHoursData: place.openingHours ? mapToUIState(place.openingHours) : null,
    
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
export function buildPlacePayload(data: PlaceFormData): Partial<Place> {
  return {
    // Step 1: Profile
    title: data.title,
    category: data.category,
    shortDesc: data.shortDesc,
    description: data.description,
    ageTags: data.ageTags,
    visitFormats: data.visitFormats,
    activityTypes: data.activityTypes,
    
    // Step 2: Location
    lat: data.lat,
    lng: data.lng,
    googlePlaceId: data.googlePlaceId,
    formattedAddr: data.formattedAddr,
    addressJson: data.addressJson,
    customAddress: data.customAddress,
    cityId: data.cityId,
    districtAutoId: data.districtAutoId,
    districtManualId: data.districtManualId,
    metroAutoId: data.metroAutoId,
    metroAutoDistanceM: data.metroAutoDistanceM,
    metroManualId: data.metroManualId,
    metroManualDistanceM: data.metroManualDistanceM,
    
    // Step 3: Contacts
    phone: data.phone,
    website: data.website,
    instagramHandle: data.instagramHandle,
    instagramUrl: data.instagramUrl,
    
    // Step 4: Photos
    logoImageId: data.logoImageId,
    logoUrl: data.logoUrl,
    
    // Step 5: Opening Hours (handled separately via openingHoursData)
    // openingHoursId is set by backend after creating OpeningHours record
    
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
): Partial<Place> {
  const changes: Partial<Place> = {};
  const payload = buildPlacePayload(current);
  const originalPayload = buildPlacePayload(original);
  
  // Compare each field
  for (const key in payload) {
    const currentValue = payload[key as keyof typeof payload];
    const originalValue = originalPayload[key as keyof typeof originalPayload];
    
    // Deep comparison for arrays and objects
    if (JSON.stringify(currentValue) !== JSON.stringify(originalValue)) {
      (changes as any)[key] = currentValue;
    }
  }
  
  return changes;
}

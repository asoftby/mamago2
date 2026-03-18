/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Place, PlaceImage } from "@prisma/client";
import type { OpeningHoursData } from "@/components/openingHours";

interface PlaceWithImages extends Omit<Place, 'images'> {
  images: Array<Omit<PlaceImage, 'placeId'> & { placeId?: string; revisionId?: string }>;
  openingHours?: any;
}

export type SectionStatus = "complete" | "partial" | "empty";

/**
 * Get completion status for Profile section
 */
export function getProfileStatus(place: PlaceWithImages): SectionStatus {
  const hasRequired = !!(place.title && place.category && place.shortDesc && place.description);
  const hasOptional = !!(place.ageTags?.length || place.visitFormats?.length || place.activityTypes?.length);
  
  if (hasRequired && hasOptional) return "complete";
  if (hasRequired) return "partial";
  return "empty";
}

/**
 * Get completion status for Location section
 */
export function getLocationStatus(place: PlaceWithImages): SectionStatus {
  const hasCoordinates = !!(place.lat && place.lng);
  const hasAddress = !!place.formattedAddr;
  const hasCity = !!place.cityId;
  const hasDistrict = !!(place.districtAutoId || place.districtManualId);
  const hasMetro = !!(place.metroAutoId || place.metroManualId);
  
  if (!hasCoordinates) return "empty";
  
  const optionalCount = [hasAddress, hasCity, hasDistrict, hasMetro].filter(Boolean).length;
  if (optionalCount >= 2) return "complete";
  if (optionalCount >= 1) return "partial";
  return "partial"; // Has coordinates but minimal other info
}

/**
 * Get completion status for Photos section
 */
export function getPhotosStatus(place: PlaceWithImages): SectionStatus {
  const hasLogo = !!place.logoImageId;
  const hasGallery = place.images?.length > 0;
  
  if (hasLogo && hasGallery) return "complete";
  if (hasLogo || hasGallery) return "partial";
  return "empty";
}

/**
 * Get completion status for Contacts section
 */
export function getContactsStatus(place: PlaceWithImages): SectionStatus {
  const contacts = [place.phone, place.website, place.instagramHandle].filter(Boolean);
  
  if (contacts.length >= 2) return "complete";
  if (contacts.length >= 1) return "partial";
  return "empty";
}

/**
 * Get completion status for Opening Hours section
 */
export function getOpeningHoursStatus(openingHoursData: OpeningHoursData | null): SectionStatus {
  if (!openingHoursData) return "empty";
  
  if (openingHoursData.mode === "ALWAYS_OPEN") return "complete";
  if (openingHoursData.mode === "TEMPORARILY_CLOSED") return "complete";
  if (openingHoursData.mode === "BY_APPOINTMENT") return "complete";
  
  if (openingHoursData.mode === "WEEKLY") {
    const hasSchedule = openingHoursData.rules && openingHoursData.rules.length > 0;
    if (hasSchedule) return "complete";
    return "partial";
  }
  
  return "empty";
}

/**
 * Format age tags for display
 */
export function formatAgeTags(ageTags: string[] | null): string {
  if (!ageTags || ageTags.length === 0) return "Не указано";
  return ageTags.join(", ");
}

/**
 * Format visit formats for display
 */
export function formatVisitFormats(visitFormats: string[] | null): string {
  if (!visitFormats || visitFormats.length === 0) return "Не указано";
  return visitFormats.join(", ");
}

/**
 * Format activity types for display
 */
export function formatActivityTypes(activityTypes: string[] | null): string {
  if (!activityTypes || activityTypes.length === 0) return "Не указано";
  return activityTypes.join(", ");
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number | null, lng: number | null): string {
  if (!lat || !lng) return "Не указано";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Get status badge props
 */
export function getStatusBadgeProps(status: SectionStatus) {
  switch (status) {
    case "complete":
      return {
        variant: "default" as const,
        className: "bg-green-100 text-green-800 border-green-200",
        text: "Заполнено"
      };
    case "partial":
      return {
        variant: "secondary" as const,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        text: "Заполнено частично"
      };
    case "empty":
      return {
        variant: "outline" as const,
        className: "bg-gray-100 text-gray-600 border-gray-200",
        text: "Не заполнено"
      };
  }
}
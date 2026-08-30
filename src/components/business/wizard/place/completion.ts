import type { PlaceFormData } from "./types";
import { isPlaceAgeSelectionComplete } from "./isPlaceAgeChipActive";

/**
 * Field weights for completion calculation
 * Higher weight = more important for card quality
 */
const FIELD_WEIGHTS = {
  // Critical fields (high weight)
  title: 15,
  category: 15,
  description: 10,
  shortDesc: 10,
  
  // Important fields (medium weight)
  lat: 8,
  lng: 8,
  ageTags: 8,
  
  // Valuable fields (medium-low weight)
  logoImageId: 6,
  images: 6,
  openingHours: 6,
  
  // Nice to have (low weight)
  phone: 3,
  website: 3,
  visitFormats: 3,
  instagramHandle: 2,
} as const;

export interface CompletionResult {
  /** Completion percentage (0-100) */
  percent: number;
  /** Total possible score */
  totalScore: number;
  /** Achieved score */
  achievedScore: number;
  /** List of completed field names */
  completedFields: string[];
  /** List of missing field names with their weights */
  missingFields: Array<{ field: string; weight: number; label: string }>;
}

/**
 * Calculate place card completion score
 * Returns percentage based on weighted fields
 */
export function getPlaceCompletion(data: PlaceFormData): CompletionResult {
  const completedFields: string[] = [];
  const missingFields: Array<{ field: string; weight: number; label: string }> = [];
  
  let achievedScore = 0;
  const totalScore = Object.values(FIELD_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  
  // Check title
  if (data.title && data.title.trim().length > 0) {
    achievedScore += FIELD_WEIGHTS.title;
    completedFields.push("title");
  } else {
    missingFields.push({ field: "title", weight: FIELD_WEIGHTS.title, label: "Название" });
  }
  
  // Check category
  if (data.category) {
    achievedScore += FIELD_WEIGHTS.category;
    completedFields.push("category");
  } else {
    missingFields.push({ field: "category", weight: FIELD_WEIGHTS.category, label: "Категория" });
  }
  
  // Check description
  if (data.description && data.description.trim().length > 0) {
    achievedScore += FIELD_WEIGHTS.description;
    completedFields.push("description");
  } else {
    missingFields.push({ field: "description", weight: FIELD_WEIGHTS.description, label: "Полное описание" });
  }
  
  // Check short description
  if (data.shortDesc && data.shortDesc.trim().length > 0) {
    achievedScore += FIELD_WEIGHTS.shortDesc;
    completedFields.push("shortDesc");
  } else {
    missingFields.push({ field: "shortDesc", weight: FIELD_WEIGHTS.shortDesc, label: "Краткое описание" });
  }
  
  // Check location (lat)
  if (data.lat !== null) {
    achievedScore += FIELD_WEIGHTS.lat;
    completedFields.push("lat");
  } else {
    missingFields.push({ field: "lat", weight: FIELD_WEIGHTS.lat, label: "Координаты (широта)" });
  }
  
  // Check location (lng)
  if (data.lng !== null) {
    achievedScore += FIELD_WEIGHTS.lng;
    completedFields.push("lng");
  } else {
    missingFields.push({ field: "lng", weight: FIELD_WEIGHTS.lng, label: "Координаты (долгота)" });
  }
  
  // Age is complete only when the discriminated policy is asserted and its
  // tag payload is compatible with that policy. Migrated UNKNOWN rows remain
  // intentionally incomplete until an editor makes a choice.
  if (isPlaceAgeSelectionComplete({ agePolicy: data.agePolicy, ageTags: data.ageTags })) {
    achievedScore += FIELD_WEIGHTS.ageTags;
    completedFields.push("ageTags");
  } else {
    missingFields.push({ field: "ageTags", weight: FIELD_WEIGHTS.ageTags, label: "Возраст" });
  }
  
  // Check logo
  if (data.logoImageId || data.logoUrl) {
    achievedScore += FIELD_WEIGHTS.logoImageId;
    completedFields.push("logoImageId");
  } else {
    missingFields.push({ field: "logoImageId", weight: FIELD_WEIGHTS.logoImageId, label: "Логотип" });
  }
  
  // Check gallery images
  if (data.images && data.images.length > 0) {
    achievedScore += FIELD_WEIGHTS.images;
    completedFields.push("images");
  } else {
    missingFields.push({ field: "images", weight: FIELD_WEIGHTS.images, label: "Фотографии" });
  }
  
  // Check opening hours
  if (data.openingHoursData && data.openingHoursData.mode) {
    achievedScore += FIELD_WEIGHTS.openingHours;
    completedFields.push("openingHours");
  } else {
    missingFields.push({ field: "openingHours", weight: FIELD_WEIGHTS.openingHours, label: "Режим работы" });
  }
  
  // Check phone
  if (
    (data.phone && data.phone.trim().length > 0) ||
    (data.phone2 && data.phone2.trim().length > 0) ||
    (data.phone3 && data.phone3.trim().length > 0)
  ) {
    achievedScore += FIELD_WEIGHTS.phone;
    completedFields.push("phone");
  } else {
    missingFields.push({ field: "phone", weight: FIELD_WEIGHTS.phone, label: "Телефон" });
  }
  
  // Check website
  if (data.website && data.website.trim().length > 0) {
    achievedScore += FIELD_WEIGHTS.website;
    completedFields.push("website");
  } else {
    missingFields.push({ field: "website", weight: FIELD_WEIGHTS.website, label: "Веб-сайт" });
  }
  
  // Check visit formats
  if (data.visitFormats && data.visitFormats.length > 0) {
    achievedScore += FIELD_WEIGHTS.visitFormats;
    completedFields.push("visitFormats");
  } else {
    missingFields.push({ field: "visitFormats", weight: FIELD_WEIGHTS.visitFormats, label: "Формат посещения" });
  }
  
  // Check Instagram
  if (data.instagramHandle && data.instagramHandle.trim().length > 0) {
    achievedScore += FIELD_WEIGHTS.instagramHandle;
    completedFields.push("instagramHandle");
  } else {
    missingFields.push({ field: "instagramHandle", weight: FIELD_WEIGHTS.instagramHandle, label: "Instagram" });
  }
  
  const percent = Math.round((achievedScore / totalScore) * 100);
  
  return {
    percent,
    totalScore,
    achievedScore,
    completedFields,
    missingFields: missingFields.sort((a, b) => b.weight - a.weight), // Sort by weight descending
  };
}

/**
 * Get completion message based on percentage
 */
export function getCompletionMessage(percent: number): string {
  if (percent === 100) {
    return "Карточки с полной информацией ранжируются выше в выдаче";
  }
  
  if (percent >= 80) {
    return "Почти готово! Заполните оставшиеся поля для лучшего ранжирования";
  }
  
  return "Заполните карточку полностью, чтобы она выглядела лучше для пользователей";
}

/**
 * Get completion color based on percentage
 */
export function getCompletionColor(percent: number): string {
  if (percent === 100) return "text-green-600";
  if (percent >= 80) return "text-blue-600";
  if (percent >= 50) return "text-amber-600";
  return "text-gray-600";
}

/**
 * Get progress bar color based on percentage
 */
export function getProgressBarColor(percent: number): string {
  if (percent === 100) return "bg-green-600";
  if (percent >= 80) return "bg-blue-600";
  if (percent >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

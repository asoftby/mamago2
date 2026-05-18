// Offer Wizard Types
// Refactored for multi-type support (SINGLE, REGULAR, CAMP)

import type { PublicationAccess } from "@/features/publication-access";

export type OfferWizardMode = "create" | "edit";

/** Offer types for wizard */
export type OfferWizardType = "SINGLE" | "REGULAR" | "CAMP";
export type OfferContactSource = "manual" | "place";

/** Смена лагеря (шаг «Смены и расписание») */
export type CampSessionKind = "day" | "full_day" | "residential";

export type CampLodgingTypeKey =
  | "hotel"
  | "resort_base"
  | "camping"
  | "cottage"
  | "sanatorium"
  | "other";

export type CampMealKey = "breakfast" | "lunch" | "dinner" | "snacks";

export interface CampSessionEntry {
  id: string;
  /** Для будущей сортировки drag-and-drop */
  sortOrder: number;
  title: string;
  dateFrom: string | null;
  dateTo: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  sessionKind: CampSessionKind;
  ageFrom: number | null;
  ageTo: number | null;
  capacity: number | null;
  spotsLeft: number | null;
  priceOverride: string;
  description: string;
}

/** Step keys for wizard */
export type OfferWizardStepKey =
  | "type"
  | "details"
  | "photo"
  | "conditions"
  | "campSchedule"
  | "accommodation"
  | "price"
  | "contacts"
  | "review";

/**
 * Complete Offer Form Data
 * Follows Event Wizard structure with offer-specific fields
 * Now supports SINGLE, REGULAR, and CAMP types
 */
export interface OfferFormData {
  // Step 1: Offer Type
  offerWizardType: OfferWizardType | null; // SINGLE, REGULAR, or CAMP
  
  // Legacy fields (for backward compatibility)
  offerKind: "course" | "birthday" | "service" | null;
  durationType: "single" | "recurring" | "camp" | null;
  serviceType: "торт" | "декор" | "фотограф" | "аниматор" | "шоу" | "аквагрим" | "ведущий" | "мастер_класс_на_выезд" | "другое" | null;
  locationType: "client_location" | "place" | "remote" | null;
  intent: "куда_пойти" | "занятия" | "день_рождения" | null;
  
  // Step 2: Details / Public Information
  title: string;
  shortDescription: string; // max 120 chars
  description: string; // Rich text HTML for full description
  ageGroups: string[];
  
  // Camp-specific details (Step 2 for CAMP type)
  campProgramType: "городской" | "выездной" | "смешанный" | null; // Only for CAMP
  
  // Step 3: Media
  placeId: string | null;
  placeTitle: string;
  coverImage: string | null;
  gallery: string[];
  videoUrl: string | null; // New: YouTube, YouTube Shorts, Instagram Reels
  
  // Step 4: Conditions (for SINGLE/REGULAR) or Step 4: Camp Schedule (for CAMP)
  // Class fields (SINGLE/REGULAR)
  classDuration: string;
  classGroupSize: string;
  classFormat: "trial" | "course" | "subscription" | null;
  
  // Camp schedule fields (CAMP only): JSON в БД (campSessions)
  campSessions: CampSessionEntry[];
  campSessionDuration: string; // e.g., "7 дней", "2 недели"
  campStayDuration: string; // e.g., "с 9:00 до 17:00", "круглосуточно"
  campPlacesCount: number | null;
  campGroupSize: number | null;
  campDaySchedule: string; // Description of daily schedule
  campCanSelectDays: boolean; // Can select individual days
  campHasExtendedCare: boolean; // Has extended care option
  
  // Party fields
  partyProgram: string;
  partyDuration: string;
  partyChildrenCount: string;
  partyIncluded: string;
  
  // Service fields
  serviceDescription: string;
  serviceDuration: string;
  serviceDeliveryArea: string;
  
  // Step 5 (for CAMP): Accommodation
  accommodationProvided: boolean;
  /** Ключ из CampLodgingTypeKey, в БД — accommodationType */
  accommodationType: CampLodgingTypeKey | "";
  accommodationAddress: string;
  accommodationRooms: string;
  accommodationConditions: string;
  campIncludedMeals: CampMealKey[];
  mealInfo: string; // legacy / свободный текст при необходимости
  transferInfo: string;
  whatToBring: string;
  campSafetyInfo: string;
  campMedicalInfo: string;
  
  // Step 5/6: Pricing
  pricingMode: "single" | "multiple";
  singlePrice: string;
  singleCurrency: "BYN" | "USD" | "EUR";
  priceCaption: string;
  pricingOptions: PricingOption[];
  promotionDetails: string;
  
  // Step 6/7: Contacts
  contactSource: OfferContactSource;
  phone: string;
  website: string;
  socialLinks: SocialLink[];
  
  // Step 7/8: CTA and Publication
  publicationAccess: PublicationAccess | null;
  ctaType: "записаться" | "забронировать" | "купить_билет" | "отправить_заявку" | "перейти_на_сайт" | null;
  ctaPhone: string;
  ctaLink: string;
  ctaInstructions: string;

  /** Сигналы DISCOVERY домена (entityType=OFFER), опционально. */
  signalIds: string[];
  /** Привязка к чипам публичной витрины /[city]/classes. */
  classChipSlugs: string[];
  
  // Booking Settings (only for ctaType = "забронировать")
  bookingSettings: {
    mode: "request" | "slot" | "external" | null;
    selectionType: "date_only" | "date_time" | null;
    availableDaysAhead: number | null;
    capacityPerUnit: number | null;
    leadTime: string | null;
    slotDurationMinutes: number | null;
    externalUrl: string | null;
    externalButtonLabel: string | null;
    weeklyAvailability: Array<{
      day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
      enabled: boolean;
      startTime: string | null;
      endTime: string | null;
    }>;
    excludedDates: string[];
  };
}

export interface PricingOption {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  description: string;
}

export interface SocialLink {
  id: string;
  network: "instagram" | "telegram" | "tiktok" | "youtube" | "other";
  url: string;
}

/**
 * Draft validation rules (soft)
 * Minimum required to save as draft
 */
export const DRAFT_REQUIRED = {
  sourceType: true,
  title: true,
} as const;

/**
 * Submit validation rules (strict)
 * Required for moderation submission
 */
export const SUBMIT_REQUIRED = {
  // Step 1
  sourceType: true,
  placeId_or_eventId: true,
  
  // Step 2
  offerKind: true,
  
  // Step 3
  title: true,
  shortDescription: true,
  description: true,
  ageGroups: true,
  
  // Step 4
  coverImage: true,
  
  // Step 5 (conditional on offer kind)
  format_conditions: true,
  
  // Step 6
  pricing: true,
  
  // Step 8
  ctaType: true,
} as const;

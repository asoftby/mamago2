// Offer Wizard Types
// Inherits Event Wizard architecture 1-to-1

export type OfferWizardMode = "create" | "edit";

/**
 * Complete Offer Form Data
 * Follows Event Wizard structure with offer-specific fields
 */
export interface OfferFormData {
  // Step 1: Offer Type (was Step 2)
  offerKind: "course" | "birthday" | "service" | null;
  durationType: "single" | "recurring" | "camp" | null; // For courses only
  
  // Service-specific fields (for SERVICE offers)
  serviceType: "торт" | "декор" | "фотограф" | "аниматор" | "шоу" | "аквагрим" | "ведущий" | "мастер_класс_на_выезд" | "другое" | null;
  locationType: "client_location" | "place" | "remote" | null;
  
  // Auto-determined intent (not user-selectable)
  intent: "куда_пойти" | "занятия" | "день_рождения" | null;
  
  // Step 2: Public Information (was Step 3)
  title: string;
  shortDescription: string; // max 120 chars
  ageGroups: string[];
  
  // Step 3: Media (was Step 4)
  coverImage: string | null;
  gallery: string[];
  
  // Step 4: Format and Conditions (was Step 5)
  // Class fields
  classDuration: string;
  classGroupSize: string;
  classFormat: "trial" | "course" | "subscription" | null;
  
  // Camp fields (for durationType = "camp")
  campSessions: Array<{
    dateFrom: string | null;
    dateTo: string | null;
  }>;
  campPriceText: string;
  
  // Party fields
  partyProgram: string;
  partyDuration: string;
  partyChildrenCount: string;
  partyIncluded: string;
  
  // Service fields
  serviceDescription: string;
  serviceDuration: string;
  serviceDeliveryArea: string;
  
  // Step 5: Pricing (was Step 6)
  pricingMode: "single" | "multiple";
  singlePrice: string;
  singleCurrency: "BYN" | "USD" | "EUR";
  singlePriceLabel: string;
  
  // Multiple pricing options
  pricingOptions: PricingOption[];
  
  // Step 6: Contacts (was Step 7)
  phone: string;
  website: string;
  socialLinks: SocialLink[];
  
  // Step 7: CTA and Publication (was Step 8)
  ctaType: "записаться" | "забронировать" | "купить_билет" | "отправить_заявку" | "перейти_на_сайт" | null;
  ctaPhone: string;
  ctaLink: string;
  ctaInstructions: string;

  /** Сигналы DISCOVERY домена (entityType=OFFER), опционально. */
  signalIds: string[];
  
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
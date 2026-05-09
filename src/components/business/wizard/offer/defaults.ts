// Offer Wizard Defaults
// Refactored for multi-type support (SINGLE, REGULAR, CAMP)

import type { OfferFormData } from "./types";

export function getDefaultFormData(): OfferFormData {
  return {
    // Step 1: Offer Type
    offerWizardType: null,
    
    // Legacy fields (for backward compatibility)
    offerKind: null,
    durationType: null,
    serviceType: null,
    locationType: null,
    intent: null,
    
    // Step 2: Details / Public Information
    title: "",
    shortDescription: "",
    description: "",
    ageGroups: [],
    campProgramType: null,
    
    // Step 3: Media
    coverImage: null,
    gallery: [],
    videoUrl: null,
    
    // Step 4: Conditions / Camp Schedule
    // Class fields
    classDuration: "",
    classGroupSize: "",
    classFormat: null,
    
    // Camp schedule fields
    campSessions: [],
    campSessionDuration: "",
    campStayDuration: "",
    campPlacesCount: null,
    campGroupSize: null,
    campDaySchedule: "",
    campCanSelectDays: false,
    campHasExtendedCare: false,
    
    // Party fields
    partyProgram: "",
    partyDuration: "",
    partyChildrenCount: "",
    partyIncluded: "",
    
    // Service fields
    serviceDescription: "",
    serviceDuration: "",
    serviceDeliveryArea: "",
    
    // Step 5 (for CAMP): Accommodation
    accommodationProvided: false,
    accommodationType: "",
    accommodationConditions: "",
    mealInfo: "",
    transferInfo: "",
    whatToBring: "",
    
    // Step 5/6: Pricing
    pricingMode: "single",
    singlePrice: "",
    singleCurrency: "BYN",
    singlePriceLabel: "",
    pricingOptions: [],
    promotionalOffer: "",
    
    // Step 6/7: Contacts
    phone: "",
    website: "",
    socialLinks: [],
    
    // Step 7/8: CTA and Publication
    ctaType: null,
    ctaPhone: "",
    ctaLink: "",
    ctaInstructions: "",

    // Signals (DISCOVERY domain, entityType=OFFER)
    signalIds: [],
    
    // Booking Settings (only for ctaType = "забронировать")
    bookingSettings: {
      mode: null,
      selectionType: null,
      availableDaysAhead: null,
      capacityPerUnit: null,
      leadTime: null,
      slotDurationMinutes: null,
      externalUrl: null,
      externalButtonLabel: null,
      weeklyAvailability: [
        { day: "monday", enabled: false, startTime: null, endTime: null },
        { day: "tuesday", enabled: false, startTime: null, endTime: null },
        { day: "wednesday", enabled: false, startTime: null, endTime: null },
        { day: "thursday", enabled: false, startTime: null, endTime: null },
        { day: "friday", enabled: false, startTime: null, endTime: null },
        { day: "saturday", enabled: false, startTime: null, endTime: null },
        { day: "sunday", enabled: false, startTime: null, endTime: null },
      ],
      excludedDates: [],
    },
  };
}

/**
 * Check if form has meaningful content for autosave
 */
export function hasMeaningfulContent(data: OfferFormData): boolean {
  return !!(
    data.offerKind ||
    data.title ||
    data.shortDescription
  );
}

/**
 * Check if form meets minimum draft requirements
 */
export function canSaveAsDraft(data: OfferFormData): boolean {
  return !!(
    data.offerKind &&
    data.title.trim().length > 0
  );
}

/**
 * Auto-determine intent based on source and offer kind
 */
export function determineIntent(data: OfferFormData): "куда_пойти" | "занятия" | "день_рождения" | null {
  if (!data.offerKind) return null;
  
  if (data.offerKind === "course") {
    return data.durationType === "recurring" ? "занятия" : "куда_пойти";
  }
  if (data.offerKind === "birthday") return "день_рождения";
  if (data.offerKind === "service") return "день_рождения";
  
  return null;
}

/**
 * Auto-suggest CTA type based on offer data
 */
export function suggestCTAType(data: OfferFormData): "записаться" | "забронировать" | "купить_билет" | "отправить_заявку" | "перейти_на_сайт" | null {
  if (!data.offerKind) return null;
  
  switch (data.offerKind) {
    case "course":
      return "записаться";
    case "birthday":
      return "отправить_заявку";
    case "service":
      return "отправить_заявку";
    default:
      return null;
  }
}
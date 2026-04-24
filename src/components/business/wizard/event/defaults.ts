// Event Wizard Defaults

import type { EventFormData, SocialLink } from "./types";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
import { isRichTextMeaningful } from "@/lib/richtext/utils";

/** Одна стартовая строка соцсетей (Instagram, URL пустой). */
export function createDefaultSocialLink(id?: string): SocialLink {
  return {
    id: id ?? `social-${Date.now()}`,
    network: "instagram",
    url: "",
  };
}

export function createDefaultScheduleItem(id = "default"): EventScheduleItem {
  return {
    id,
    isMultiDay: false,
    date: null,
    dateEnd: null,
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "week",
    recurrenceUntil: null,
    isCollapsed: false,
  };
}

export function getDefaultFormData(): EventFormData {
  return {
    // Step 1: Basics
    title: "",
    eventFormats: [],
    categoryIds: [],
    subcategoryIdsByCategoryId: {},
    categoryId: null,
    subcategoryId: null,
    primaryRootHasChildren: false,
    ageRangeIds: [],
    ageTags: [],
    ageDetection: {
      raw: null,
      confidence: "none",
      suggestedBuckets: [],
      normalizedLabel: null,
      parsedMinAge: null,
      parsedMaxAge: null,
    },
    ageDetectionUserOverride: false,
    ageDetectionAutoApplied: false,
    interestIds: [],
    genreSlugByRootCategoryId: {},
    categorySlug: null,
    categoryPathLabel: null,
    programCategoryIds: [],
    cinemaGenre: "",
    cinemaDuration: undefined,
    cinemaTrailerUrl: "",
    
    // Step 2: Description
    fullDescription: "",
    
    // Step 3: Media
    coverImage: null,
    gallery: [],
    reelsUrl: "",
    
    // Step 4: Schedule (MVP: common time for all dates)
    scheduleMode: "single",
    dates: [],
    scheduleItems: [createDefaultScheduleItem()],
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    repeatEnabled: false,
    repeatUnit: null,
    repeatUntil: null,
    
    // Step 5: Pricing & Participation
    pricingMode: "free",
    price: "",
    priceDetails: "",
    ticketLink: "",
    participationMode: "walk-in",
    prebookMethod: null,
    prebookPhone: "",
    prebookUrl: "",
    simpleBookingDate: null,
    simpleBookingTime: null,
    simpleBookingCapacity: null,
    timeSlots: { dates: [] },
    
    // Step 2: Location (EventVenue)
    locationSource: null, // NEW: Track location data source
    venueKind: null,
    placeId: null,
    venueName: "",
    address: "",
    city: "",
    lat: null,
    lng: null,
    
    // District fields
    districtAutoId: null,
    districtManualId: null,
    districtName: null,
    
    // Metro fields
    metroAutoId: null,
    metroAutoDistanceM: null,
    metroManualId: null,
    metroManualDistanceM: null,
    metroName: null,
    
    // Legacy fields
    district: "",
    metro: "",
    
    source: null,
    venueNote: "",
    
    // Step 7: Contacts
    contactMode: "inherit",
    phone: "",
    website: "",
    socialLinks: [createDefaultSocialLink("social-initial")],
    
    // Step 8: Organizer
    organizerMode: "manual",
    organizerId: null,
    organizerName: "",
    organizerUnp: "",
    organizerPhone: "",
    organizerWebsite: "",
    organizerInstagram: "",
  };
}

/**
 * Check if form has meaningful content for autosave
 */
export function hasMeaningfulContent(data: EventFormData): boolean {
  return !!(
    data.title ||
    isRichTextMeaningful(data.fullDescription) ||
    data.categoryId ||
    (data.interestIds?.length ?? 0) > 0 ||
    data.dates.length > 0
  );
}

/**
 * Check if form meets minimum draft requirements
 */
export function canSaveAsDraft(data: EventFormData): boolean {
  const categoryOk =
    !!data.categoryId && (!data.primaryRootHasChildren || !!data.subcategoryId);
  return !!(data.title.trim().length > 0 && categoryOk);
}

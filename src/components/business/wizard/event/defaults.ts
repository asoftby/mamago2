// Event Wizard Defaults

import type { EventFormData } from "./types";
import { isRichTextMeaningful } from "@/lib/richtext/utils";

export function getDefaultFormData(): EventFormData {
  return {
    // Step 1: Basics
    title: "",
    activityType: null,
    categories: [],
    ageGroups: [],
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
    allDay: true,
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
    participationMode: "simple-booking",
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
    phone: "",
    website: "",
    socialLinks: [],
    
    // Step 8: Organizer
    organizerMode: "business",
    organizerId: null,
    organizerName: "",
    organizerDescription: "",
    organizerPhone: "",
    organizerWebsite: "",
    organizerLogoUrl: null,
  };
}

/**
 * Check if form has meaningful content for autosave
 */
export function hasMeaningfulContent(data: EventFormData): boolean {
  return !!(
    data.title ||
    isRichTextMeaningful(data.fullDescription) ||
    data.categories.length > 0 ||
    data.dates.length > 0
  );
}

/**
 * Check if form meets minimum draft requirements
 */
export function canSaveAsDraft(data: EventFormData): boolean {
  return !!(
    data.title.trim().length > 0 &&
    data.categories.length > 0
  );
}

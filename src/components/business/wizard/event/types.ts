// Event Wizard Types

export type EventWizardMode = "create" | "edit";

/**
 * Complete Event Form Data
 * Covers all 9 steps of the wizard
 */
export interface EventFormData {
  // Step 1: Basics
  title: string;
  activityType: "active" | "educational" | "calm" | null;
  categories: string[];
  ageGroups: string[]; // ageTags in Activity model
  
  // Cinema-specific (conditional on categories including "Кино")
  cinemaGenre?: string;
  cinemaDuration?: number;
  cinemaTrailerUrl?: string;
  
  // Step 2: Description
  fullDescription: string; // maps to description
  
  // Step 3: Media
  coverImage: string | null; // coverImageId
  gallery: string[]; // ActivityImage[]
  reelsUrl?: string;
  
  // Step 4: Schedule (MVP: all dates use common time)
  scheduleMode: "single" | "multiple";
  dates: string[]; // YYYY-MM-DD
  allDay: boolean;
  startTime: string; // HH:mm - common for all dates
  endTime: string; // HH:mm - common for all dates
  repeatEnabled: boolean;
  repeatUnit: "day" | "week" | "month" | "year" | null;
  repeatUntil: string | null; // YYYY-MM-DD
  
  // Step 5: Pricing & Participation
  pricingMode: "free" | "fixed" | "from" | "on-request";
  price: string;
  priceDetails: string; // Optional details for "from" mode (e.g., different ticket categories)
  ticketLink: string;
  participationMode: "external-link" | "time-slots" | "simple-booking" | "request" | "info-only";
  ctaType?: "book" | "buy" | "request" | "details"; // Optional - auto-determined from participationMode
  
  // Simple booking fields
  simpleBookingDate: string | null; // YYYY-MM-DD
  simpleBookingTime: string | null; // HH:mm–HH:mm
  simpleBookingCapacity: number | null;
  
  // Time slots (advanced)
  timeSlots: {
    dates: Array<{
      id: string;
      isoDate: string;
      label: string;
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
        capacity: number;
      }>;
    }>;
  };
  
  // Step 2: Location (EventVenue)
  locationSource: "PLACE" | "MANUAL" | null; // NEW: Track location data source
  venueKind: "PLACE" | "MANUAL" | "MOBILE" | "TBD" | null;
  placeId: string | null;
  venueName: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  
  // District fields (like Place)
  districtAutoId: string | null; // Automatically determined district ID
  districtManualId: string | null; // Manually selected district ID
  districtName: string | null; // District name for display
  
  // Metro fields (like Place)
  metroAutoId: string | null; // Automatically determined metro ID
  metroAutoDistanceM: number | null; // Distance to auto metro in meters
  metroManualId: string | null; // Manually selected metro ID
  metroManualDistanceM: number | null; // Distance to manual metro in meters
  metroName: string | null; // Metro name for display
  
  // Legacy fields (for backward compatibility)
  district: string;
  metro: string;
  
  source: "PLACE" | "ADDRESS_INPUT" | "MAP_PICKER" | "MOBILE" | "TBD" | null;
  venueNote: string;
  
  // Step 7: Contacts
  phone: string;
  website: string;
  socialLinks: SocialLink[];
  
  // Step 8: Organizer
  organizerMode: "business" | "existing" | "custom";
  organizerId: string | null; // For existing organizers
  organizerName: string;
  organizerDescription: string;
  organizerPhone: string;
  organizerWebsite: string;
  organizerLogoUrl: string | null;
}

export interface SocialLink {
  id: string; // client-side ID
  network: "instagram" | "telegram" | "tiktok" | "youtube" | "other";
  url: string;
}

/**
 * Draft validation rules (soft)
 * Minimum required to save as draft
 */
export const DRAFT_REQUIRED = {
  title: true,
  categories: true, // at least one
} as const;

/**
 * Submit validation rules (strict)
 * Required for moderation submission
 */
export const SUBMIT_REQUIRED = {
  // Step 1
  title: true,
  activityType: true,
  categories: true, // at least one
  ageGroups: true, // at least one
  
  // Step 2
  fullDescription: true,
  
  // Step 3
  coverImage: true,
  
  // Step 4
  dates: true, // at least one
  startTime: true, // if allDay=false
  
  // Step 5
  price_or_ticketLink: true, // if isFree=false
  
  // Step 6
  location: true, // placeId OR (venueName + address + city)
  
  // Step 8
  organizerName: true,
} as const;

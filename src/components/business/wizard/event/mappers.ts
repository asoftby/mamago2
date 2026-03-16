// Event Wizard Data Mappers

import type { EventFormData } from "./types";
import { getDefaultFormData } from "./defaults";

/**
 * Map Activity entity to EventFormData
 * Used when loading event for editing
 */
export function mapEventToFormData(event: any): EventFormData {
  const formData = getDefaultFormData();

  // Step 1: Basics
  formData.title = event.title || "";
  formData.ageGroups = event.ageTags || [];

  // Extract from scheduleJson if available
  const scheduleJson = event.scheduleJson || {};

  // Map activity type and categories from filterOptions or scheduleJson
  formData.activityType = scheduleJson.activityType || null;
  formData.categories = scheduleJson.categories || [];
  
  // Cinema fields
  if (scheduleJson.cinema) {
    formData.cinemaGenre = scheduleJson.cinema.genre;
    formData.cinemaDuration = scheduleJson.cinema.duration;
    formData.cinemaTrailerUrl = scheduleJson.cinema.trailerUrl;
  }

  // Step 2: Description
  formData.fullDescription = event.description || "";

  // Step 3: Media
  formData.coverImage = event.coverImageId || null;
  formData.gallery = event.images?.map((img: any) => img.url || img.imageId) || [];
  formData.reelsUrl = scheduleJson.reelsUrl || "";

  // Step 4: Schedule (MVP: common time for all dates)
  formData.scheduleMode = scheduleJson.scheduleMode || "single";
  formData.dates = scheduleJson.dates || [];
  formData.allDay = scheduleJson.allDay !== false;
  formData.startTime = scheduleJson.startTime || "10:00";
  formData.endTime = scheduleJson.endTime || "18:00";
  formData.repeatEnabled = scheduleJson.repeatEnabled || false;
  formData.repeatUnit = scheduleJson.repeatUnit || null;
  formData.repeatUntil = scheduleJson.repeatUntil || null;

  // Step 5: Pricing & Participation
  formData.pricingMode = event.priceFrom ? "fixed" : "free";
  formData.price = event.priceText || "";
  formData.priceDetails = scheduleJson.priceDetails || "";
  formData.ticketLink = scheduleJson.ticketLink || "";
  formData.participationMode = scheduleJson.participationMode || "info-only";
  formData.simpleBookingDate = scheduleJson.simpleBookingDate || null;
  formData.simpleBookingTime = scheduleJson.simpleBookingTime || null;
  formData.simpleBookingCapacity = scheduleJson.simpleBookingCapacity || null;
  formData.timeSlots = scheduleJson.timeSlots || { dates: [] };

  // Step 6: Location (EventVenue)
  if (event.venue) {
    formData.venueKind = event.venue.kind;
    formData.placeId = event.venue.placeId;
    formData.venueName = event.venue.title || "";
    formData.address = event.venue.addressLine || "";
    formData.city = event.venue.cityId || "";
    formData.venueNote = event.venue.note || "";
    
    // Map district and metro fields if available
    formData.districtAutoId = event.venue.districtAutoId || null;
    formData.districtManualId = event.venue.districtManualId || null;
    formData.metroAutoId = event.venue.metroAutoId || null;
    formData.metroAutoDistanceM = event.venue.metroAutoDistanceM || null;
    formData.metroManualId = event.venue.metroManualId || null;
    formData.metroManualDistanceM = event.venue.metroManualDistanceM || null;
    
    // Legacy fields for backward compatibility
    formData.district = event.venue.district || "";
    formData.metro = event.venue.metro || "";
  } else if (event.placeId) {
    // Legacy: if no venue but has placeId
    formData.venueKind = "PLACE";
    formData.placeId = event.placeId;
  } else {
    formData.venueKind = null;
  }

  // Step 7: Contacts
  formData.phone = scheduleJson.contacts?.phone || "";
  formData.website = scheduleJson.contacts?.website || "";
  formData.socialLinks = scheduleJson.contacts?.socialLinks || [];

  // Step 8: Organizer
  formData.organizerMode = scheduleJson.organizer?.mode || "currentBusiness";
  formData.organizerName = scheduleJson.organizer?.name || event.owner?.name || "";
  formData.organizerDescription = scheduleJson.organizer?.description || "";

  return formData;
}

/**
 * Build Activity payload from EventFormData
 * Used when creating or updating event
 */
export function buildEventPayload(data: EventFormData): any {
  const payload: any = {
    // Basic info
    title: data.title,
    shortDesc: "", // Not used anymore
    description: data.fullDescription,
    
    // Type
    type: "EVENT",
    
    // Age targeting
    ageTags: data.ageGroups,
    
    // Schedule mode
    scheduleMode: "MULTI_DATE",
    
    // Schedule JSON with all event-specific data
    scheduleJson: {
      // Step 1
      activityType: data.activityType,
      categories: data.categories,
      cinema: data.categories.includes("Кино") ? {
        genre: data.cinemaGenre,
        duration: data.cinemaDuration,
        trailerUrl: data.cinemaTrailerUrl,
      } : undefined,
      
      // Step 3
      reelsUrl: data.reelsUrl,
      
      // Step 4
      scheduleMode: data.scheduleMode,
      dates: data.dates,
      allDay: data.allDay,
      startTime: data.startTime,
      endTime: data.endTime,
      repeatEnabled: data.repeatEnabled,
      repeatUnit: data.repeatUnit,
      repeatUntil: data.repeatUntil,
      
      // Step 5
      pricingMode: data.pricingMode,
      priceDetails: data.priceDetails,
      ticketLink: data.ticketLink,
      participationMode: data.participationMode,
      simpleBookingDate: data.simpleBookingDate,
      simpleBookingTime: data.simpleBookingTime,
      simpleBookingCapacity: data.simpleBookingCapacity,
      timeSlots: data.timeSlots,
      
      // Step 7
      contacts: {
        phone: data.phone,
        website: data.website,
        socialLinks: data.socialLinks,
      },
      
      // Step 8
      organizer: {
        mode: data.organizerMode,
        name: data.organizerName,
        description: data.organizerDescription,
      },
    },
    
    // Pricing
    priceFrom: (data.pricingMode === "fixed" || data.pricingMode === "from") ? parseFloat(data.price) || null : null,
    priceTo: data.pricingMode === "fixed" ? parseFloat(data.price) || null : null,
    priceText: data.pricingMode === "free" ? "бесплатно" : data.price,
    priceDetails: data.priceDetails,
    currency: "BYN",
    
    // Images
    coverImageId: data.coverImage,
    
    // EventVenue (Step 6)
    venue: {
      kind: data.venueKind,
      placeId: data.venueKind === "PLACE" ? data.placeId : null,
      title: data.venueName,
      addressLine: data.address,
      cityId: data.city,
      note: data.venueNote,
      
      // District and metro fields
      districtAutoId: data.districtAutoId,
      districtManualId: data.districtManualId,
      metroAutoId: data.metroAutoId,
      metroAutoDistanceM: data.metroAutoDistanceM,
      metroManualId: data.metroManualId,
      metroManualDistanceM: data.metroManualDistanceM,
      
      // Legacy fields for backward compatibility
      district: data.district,
      metro: data.metro,
    },
  };

  return payload;
}

/**
 * Extract changes between current and original data
 * Used for PATCH updates in edit mode
 */
export function extractChanges(current: EventFormData, original: EventFormData): Partial<any> {
  const changes: any = {};

  // Compare each field and add to changes if different
  if (current.title !== original.title) {
    changes.title = current.title;
  }

  if (current.fullDescription !== original.fullDescription) {
    changes.description = current.fullDescription;
  }

  if (JSON.stringify(current.ageGroups) !== JSON.stringify(original.ageGroups)) {
    changes.ageTags = current.ageGroups;
  }

  if (current.coverImage !== original.coverImage) {
    changes.coverImageId = current.coverImage;
  }

  // For simplicity, always update scheduleJson if any schedule-related field changed
  if (
    JSON.stringify(current.dates) !== JSON.stringify(original.dates) ||
    current.allDay !== original.allDay ||
    current.startTime !== original.startTime ||
    current.endTime !== original.endTime ||
    current.repeatEnabled !== original.repeatEnabled
  ) {
    changes.scheduleJson = buildEventPayload(current).scheduleJson;
  }

  // Pricing changes
  if (current.pricingMode !== original.pricingMode || current.price !== original.price) {
    changes.priceFrom = (current.pricingMode === "fixed" || current.pricingMode === "from") ? parseFloat(current.price) || null : null;
    changes.priceTo = current.pricingMode === "fixed" ? parseFloat(current.price) || null : null;
    changes.priceText = current.pricingMode === "free" ? "бесплатно" : current.price;
  }

  // Venue changes
  if (
    current.venueKind !== original.venueKind ||
    current.placeId !== original.placeId ||
    current.venueName !== original.venueName ||
    current.address !== original.address ||
    current.city !== original.city ||
    current.venueNote !== original.venueNote ||
    current.districtAutoId !== original.districtAutoId ||
    current.districtManualId !== original.districtManualId ||
    current.metroAutoId !== original.metroAutoId ||
    current.metroManualId !== original.metroManualId
  ) {
    changes.venue = buildEventPayload(current).venue;
  }

  return changes;
}

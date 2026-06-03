import { PlaceKind } from "@prisma/client";
import type { PlaceFormData } from "./types";

/**
 * Default values for new place creation
 */
export function getDefaultFormData(): PlaceFormData {
  return {
    // Step 1: Profile
    title: "",
    category: "",
    shortDesc: "",
    description: null,
    ageTags: [],
    visitFormats: [],
    primaryCategoryId: null,
    subcategoryIds: [],
    
    // Step 2: Location
    lat: null,
    lng: null,
    googlePlaceId: null,
    formattedAddr: null,
    addressJson: null,
    customAddress: null,
    cityId: null,
    districtAutoId: null,
    districtManualId: null,
    metroAutoId: null,
    metroAutoDistanceM: null,
    metroManualId: null,
    metroManualDistanceM: null,
    
    // Step 3: Contacts
    phone: null,
    website: null,
    instagramHandle: null,
    instagramUrl: null,
    
    // Step 4: Photos
    logoImageId: null,
    logoUrl: null,
    images: [],

    // Step 5: Opening Hours
    openingHoursId: null,
    openingHoursData: null,

    // Prices
    priceItems: { items: [], note: "" },

    // Hierarchy
    placeKind: PlaceKind.STANDALONE,
    floor: null,
    unit: null,
  };
}

/**
 * Check if form data has any meaningful content
 * Used to determine if we should warn about unsaved changes
 */
export function hasMeaningfulContent(data: PlaceFormData): boolean {
  // Check title
  if (data.title && data.title.trim().length > 0) {
    return true;
  }
  
  // Check location
  const hasLocation = 
    data.lat !== null ||
    data.lng !== null ||
    (data.googlePlaceId && data.googlePlaceId.trim().length > 0) ||
    (data.formattedAddr && data.formattedAddr.trim().length > 0) ||
    (data.customAddress && data.customAddress.trim().length > 0);
  
  if (hasLocation) {
    return true;
  }
  
  // Check images
  if (data.logoImageId || data.images.length > 0) {
    return true;
  }
  
  // Check description
  if (data.shortDesc && data.shortDesc.trim().length > 0) {
    return true;
  }
  
  if (data.description && data.description.trim().length > 0) {
    return true;
  }
  
  // Check tags
  if (data.ageTags.length > 0 || data.visitFormats.length > 0) {
    return true;
  }
  
  // Check contacts
  if (data.phone || data.website || data.instagramHandle) {
    return true;
  }
  
  return false;
}

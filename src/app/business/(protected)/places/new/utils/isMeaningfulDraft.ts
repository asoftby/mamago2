/**
 * Determines if the draft has meaningful changes that warrant a save confirmation
 * 
 * Returns true if at least one of these conditions is met:
 * - Title is non-empty
 * - Location exists (lat/lng OR formattedAddr OR customAddress OR googlePlaceId)
 * - At least 1 image added
 * - Description or shortDesc filled
 * - Any tags selected (ageTags, visitFormats, activityTypes)
 * - Any contacts filled (phone, website, instagram)
 */

interface DraftData {
  title?: string;
  shortDesc?: string;
  description?: string | null;
  
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
  formattedAddr?: string | null;
  customAddress?: string | null;
  
  images?: Array<{ url?: string; imageId?: string }>;
  
  ageTags?: string[];
  visitFormats?: string[];
  activityTypes?: string[];
  
  phone?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
}

export function isMeaningfulDraft(data: DraftData): boolean {
  // Check title
  if (data.title && data.title.trim().length > 0) {
    return true;
  }
  
  // Check location
  const hasLocation = 
    (data.lat !== null && data.lat !== undefined) ||
    (data.lng !== null && data.lng !== undefined) ||
    (data.googlePlaceId && data.googlePlaceId.trim().length > 0) ||
    (data.formattedAddr && data.formattedAddr.trim().length > 0) ||
    (data.customAddress && data.customAddress.trim().length > 0);
  
  if (hasLocation) {
    return true;
  }
  
  // Check images
  if (data.images && data.images.length > 0) {
    return true;
  }
  
  // Check descriptions
  if (data.shortDesc && data.shortDesc.trim().length > 0) {
    return true;
  }
  
  if (data.description && data.description.trim().length > 0) {
    return true;
  }
  
  // Check tags
  if (data.ageTags && data.ageTags.length > 0) {
    return true;
  }
  
  if (data.visitFormats && data.visitFormats.length > 0) {
    return true;
  }
  
  if (data.activityTypes && data.activityTypes.length > 0) {
    return true;
  }
  
  // Check contacts
  if (data.phone && data.phone.trim().length > 0) {
    return true;
  }
  
  if (data.website && data.website.trim().length > 0) {
    return true;
  }
  
  if (data.instagramHandle && data.instagramHandle.trim().length > 0) {
    return true;
  }
  
  // No meaningful changes
  return false;
}

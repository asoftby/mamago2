import type { Place } from "@prisma/client";
import type { PlaceWithImages } from "../types";

/**
 * Validate Step 1: Profile
 * Required: title, category, shortDesc, description, ageTags, visitFormats, activityTypes
 */
export function validateStep1(place: Place): boolean {
  return !!(
    place.title &&
    place.category &&
    place.shortDesc &&
    place.description &&
    place.ageTags && place.ageTags.length > 0 &&
    place.visitFormats && place.visitFormats.length > 0 &&
    place.activityTypes && place.activityTypes.length > 0
  );
}

/**
 * Validate Step 2: Location
 * Required: lat, lng
 */
export function validateStep2(place: Place): boolean {
  return !!(place.lat !== null && place.lng !== null);
}

/**
 * Validate Step 3: Photos
 * Required: logoImageId (logo must be uploaded) OR at least one gallery image
 */
export function validateStep3(place: PlaceWithImages): boolean {
  const hasLogo = !!place.logoImageId;
  const hasGalleryImages = place.images.length > 0;
  
  // At least one photo (logo or gallery) is required
  return hasLogo || hasGalleryImages;
}

/**
 * Validate Step 4: Contacts
 * Optional: all fields are optional, but check if any content exists
 */
export function validateStep4(place: Place): boolean {
  // Check if any contact information is provided
  return !!(place.phone || place.website || place.instagramHandle);
}

/**
 * Validate Step 5: Opening Hours
 * Optional: opening hours are not required, but check if configured
 */
export function validateStep5(place: Place): boolean {
  // Check if opening hours are configured (has openingHoursId)
  return !!place.openingHoursId;
}

/**
 * Validate Step 6: Review/Submit
 * This step is completed when all required steps (1-3) are valid
 */
export function validateStep6(place: PlaceWithImages): boolean {
  // Step 6 is completed when core required steps are done
  return validateStep1(place) && validateStep2(place) && validateStep3(place);
}

/**
 * Get step status based on current step and validation
 * Simplified model: current, completed, incomplete
 */
export function getStepStatus(
  targetStep: number,
  currentStep: number,
  place: PlaceWithImages
): "current" | "completed" | "incomplete" {
  // Current step
  if (targetStep === currentStep) {
    return "current";
  }

  // For other steps, check if they are completed (required fields filled)
  if (isStepValid(targetStep, place)) {
    return "completed";
  }

  return "incomplete";
}

/**
 * Check if a specific step is valid
 */
export function isStepValid(step: number, place: PlaceWithImages): boolean {
  switch (step) {
    case 1:
      return validateStep1(place);
    case 2:
      return validateStep2(place);
    case 3:
      return validateStep3(place);
    case 4:
      return validateStep4(place);
    case 5:
      return validateStep5(place);
    case 6:
      return validateStep6(place);
    default:
      return false;
  }
}

/**
 * Check if can proceed to next step
 */
export function canGoToNextStep(currentStep: number, place: PlaceWithImages): boolean {
  return isStepValid(currentStep, place);
}

/**
 * Check if can go to previous step
 */
export function canGoToPrevStep(currentStep: number): boolean {
  return currentStep > 1;
}

/**
 * Check if can go to a specific step
 * Allow navigation to any step (no locking)
 */
export function canGoToStep(
  targetStep: number,
  currentStep: number,
  place: PlaceWithImages
): boolean {
  // Allow navigation to any step 1-6
  return targetStep >= 1 && targetStep <= 6;
}
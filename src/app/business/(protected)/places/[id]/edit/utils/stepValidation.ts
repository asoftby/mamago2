import type { Place, PlaceImage } from "@prisma/client";

interface PlaceWithImages extends Place {
  images: PlaceImage[];
}

/**
 * Validate Step 1: Profile
 * Required: title, category, shortDesc
 */
export function validateStep1(place: Place): boolean {
  return !!(place.title && place.category && place.shortDesc);
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
 * 
 * For new wizard (temp media): checks logoImageId or images array length
 * For edit mode: checks logoImageId and images array
 */
export function validateStep3(place: PlaceWithImages): boolean {
  const hasLogo = !!place.logoImageId;
  const hasGalleryImages = place.images.length > 0;
  
  // At least one photo (logo or gallery) is required
  return hasLogo || hasGalleryImages;
}

/**
 * Validate Step 4: Contacts
 * Optional: all fields are optional
 */
export function validateStep4(place: Place): boolean {
  // All fields are optional, always valid
  return true;
}

/**
 * Get step status based on current step and validation
 */
export function getStepStatus(
  targetStep: number,
  currentStep: number,
  place: PlaceWithImages
): "done" | "current" | "available" | "locked" {
  // Current step
  if (targetStep === currentStep) {
    return "current";
  }

  // Past steps (always accessible)
  if (targetStep < currentStep) {
    return "done";
  }

  // Future steps - check if previous steps are valid
  if (targetStep > currentStep) {
    // Check if all previous steps are valid
    for (let step = 1; step < targetStep; step++) {
      if (!isStepValid(step, place)) {
        return "locked";
      }
    }
    return "available";
  }

  return "locked";
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
 */
export function canGoToStep(
  targetStep: number,
  currentStep: number,
  place: PlaceWithImages
): boolean {
  const status = getStepStatus(targetStep, currentStep, place);
  return status !== "locked";
}

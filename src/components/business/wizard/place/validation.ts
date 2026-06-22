import type { PlaceFormData, StepValidation } from "./types";

/**
 * Validate Step 1: Profile
 * Required: title, category, shortDesc, description, ageTags, visitFormats
 */
export function validateStep1(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push("Название обязательно");
  }
  
  if (!data.category) {
    errors.push("Категория обязательна");
  }
  
  if (!data.primaryCategoryId) {
    errors.push("Выберите основную категорию");
  }
  
  if (!data.subcategoryIds || data.subcategoryIds.length === 0) {
    errors.push("Выберите хотя бы одну подкатегорию");
  }
  
  if (data.subcategoryIds && data.subcategoryIds.length > 3) {
    errors.push("Можно выбрать не больше 3 подкатегорий");
  }
  
  if (!data.shortDesc || data.shortDesc.trim().length === 0) {
    errors.push("Краткое описание обязательно");
  }
  
  if (!data.description || data.description.trim().length === 0) {
    errors.push("Полное описание обязательно");
  }
  
  if (!data.ageTags || data.ageTags.length === 0) {
    errors.push("Выберите хотя бы один возраст");
  }
  
  if (!data.visitFormats || data.visitFormats.length === 0) {
    errors.push("Выберите хотя бы один формат посещения");
  }
  
  return {
    isValid: errors.length === 0,
    isComplete: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 2: Location
 * Required: lat, lng
 */
export function validateStep2(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  
  if (data.lat === null || data.lng === null) {
    errors.push("Укажите местоположение на карте");
  }
  
  return {
    isValid: errors.length === 0,
    isComplete: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 3: Contacts
 * Optional: all fields are optional
 */
export function validateStep3(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  
  // Contacts are optional, but check if any are provided
  const hasAnyContact = !!(
    data.phone ||
    data.phone2 ||
    data.phone3 ||
    data.website ||
    data.instagramHandle
  );
  
  return {
    isValid: true, // Always valid (optional step)
    isComplete: hasAnyContact,
    errors,
  };
}

/**
 * Validate Step 4: Photos
 * Required: at least one photo (logo OR gallery image)
 */
export function validateStep4(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  
  const hasLogo =
    !!data.logoImageId ||
    data.images.some((img) => img.kind === "LOGO" && !!img.url?.trim());
  const hasGalleryImages = data.images.length > 0;
  
  if (!hasLogo && !hasGalleryImages) {
    errors.push("Добавьте хотя бы одно фото (логотип или галерею)");
  }
  
  return {
    isValid: errors.length === 0,
    isComplete: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 5: Opening Hours
 * Optional: opening hours are not required
 */
export function validateStep5(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  
  // Check if opening hours are configured
  const hasOpeningHours = !!data.openingHoursData && (
    data.openingHoursData.mode === "ALWAYS_OPEN" ||
    data.openingHoursData.mode === "BY_APPOINTMENT" ||
    data.openingHoursData.mode === "TEMPORARILY_CLOSED" ||
    (data.openingHoursData.mode === "WEEKLY" && 
     data.openingHoursData.rules.some(rule => 
       rule.isOpen && rule.intervals && rule.intervals.length > 0
     ))
  );
  
  return {
    isValid: true, // Always valid (optional step)
    isComplete: hasOpeningHours,
    errors,
  };
}

/**
 * Validate Step 6: Review
 * This step is valid when all required steps (1, 2, 4) are complete
 */
export function validateStep6(data: PlaceFormData): StepValidation {
  const step1 = validateStep1(data);
  const step2 = validateStep2(data);
  const step4 = validateStep4(data);
  
  const allRequiredComplete = step1.isComplete && step2.isComplete && step4.isComplete;
  
  const errors: string[] = [];
  if (!allRequiredComplete) {
    errors.push("Заполните все обязательные шаги");
  }
  
  return {
    isValid: allRequiredComplete,
    isComplete: allRequiredComplete,
    errors,
  };
}

/**
 * Validate specific step by number
 */
export function validateStep(step: number, data: PlaceFormData): StepValidation {
  switch (step) {
    case 1:
      return validateStep1(data);
    case 2:
      return validateStep2(data);
    case 3:
      return validateStep3(data);
    case 4:
      return validateStep4(data);
    case 5:
      return validateStep5(data);
    case 6:
      return validateStep6(data);
    default:
      return { isValid: false, isComplete: false, errors: ["Invalid step"] };
  }
}

/**
 * Check if step is complete (has all required data)
 */
export function isStepComplete(step: number, data: PlaceFormData): boolean {
  const validation = validateStep(step, data);
  return validation.isComplete;
}

/**
 * Validate entire form for submission
 * All required steps must be complete
 */
export function validateForSubmit(data: PlaceFormData): StepValidation {
  const step1 = validateStep1(data);
  const step2 = validateStep2(data);
  const step4 = validateStep4(data);
  
  const allErrors = [
    ...step1.errors,
    ...step2.errors,
    ...step4.errors,
  ];
  
  return {
    isValid: allErrors.length === 0,
    isComplete: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Check if user can navigate to next step
 */
export function canGoToNextStep(currentStep: number, data: PlaceFormData): boolean {
  // Can always go to next step (validation happens on submit, not navigation)
  return currentStep < 6;
}

/**
 * Check if user can navigate to previous step
 */
export function canGoToPrevStep(currentStep: number): boolean {
  return currentStep > 1;
}

/**
 * Check if user can navigate to specific step
 */
export function canGoToStep(targetStep: number, currentStep: number, data: PlaceFormData): boolean {
  // Can always navigate between steps (no blocking)
  return targetStep >= 1 && targetStep <= 6;
}

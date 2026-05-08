// Offer Wizard Validation
// Inherits Event Wizard architecture 1-to-1

import type { OfferFormData } from "./types";

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate for draft save (soft validation)
 */
export function validateForDraft(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.offerKind) {
    errors.push("Выберите тип предложения");
  }
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push("Укажите название предложения");
  }
  
  return {
    isValid: errors.length === 0,
    isComplete: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate a specific step
 */
export function validateStep(step: number, data: OfferFormData): ValidationResult {
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
    case 7:
      return validateStep7(data);
    case 8:
      return validateForSubmit(data);
    default:
      return { isValid: true, isComplete: true, errors: [], warnings: [] };
  }
}

/**
 * Step 1: Offer Type
 */
function validateStep1(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.offerKind) {
    errors.push("Выберите тип предложения");
  }

  if (data.offerKind === "course" && !data.durationType) {
    errors.push("Выберите формат занятий");
  }

  if (data.offerKind === "service") {
    if (!data.serviceType) {
      errors.push("Выберите тип услуги");
    }
    if (!data.locationType) {
      errors.push("Выберите где оказывается услуга");
    }
  }

  const isComplete = Boolean(
    data.offerKind &&
    (data.offerKind !== "course" || data.durationType) &&
    (data.offerKind !== "service" || (data.serviceType && data.locationType))
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 2: Public Information
 */
function validateStep2(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push("Название должно содержать минимум 3 символа");
  }

  if (!data.shortDescription || data.shortDescription.trim().length < 10) {
    errors.push("Краткое описание должно содержать минимум 10 символов");
  }

  if (data.shortDescription && data.shortDescription.length > 120) {
    errors.push("Краткое описание не должно превышать 120 символов");
  }

  if (!data.description || data.description.trim().length < 20) {
    errors.push("Подробное описание должно содержать минимум 20 символов");
  }

  if (data.ageGroups.length === 0) {
    warnings.push("Рекомендуется указать возрастные группы");
  }

  // Validate Discovery Signals (structured groups)
  const signalIds = data.signalIds ?? [];
  
  // Helper to count signals in a group by slug prefix
  const countSignalsInGroup = (slugPrefix: string): number => {
    // Note: We need to check against actual signal IDs, but we don't have the mapping here
    // For now, we'll do a basic count check
    // TODO: Improve this by loading signal definitions or passing them as context
    return signalIds.length; // Placeholder - will be validated on backend
  };

  // Basic validation: check if signals are selected
  if (signalIds.length === 0) {
    errors.push("Выберите характеристики предложения (активность, формат, участие)");
  } else {
    // More specific validation would require loading signal definitions
    // For now, we rely on the UI component to enforce min/max
    if (signalIds.length < 3) {
      warnings.push("Рекомендуется выбрать минимум 3 характеристики (по одной из каждой обязательной группы)");
    }
  }

  const isComplete = Boolean(
    data.title.trim().length >= 3 &&
    data.shortDescription.trim().length >= 10 &&
    data.shortDescription.length <= 120 &&
    signalIds.length >= 3 // Минимум: 1 activity + 1 format + 1 participation
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 3: Media
 */
function validateStep3(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.coverImage) {
    errors.push("Загрузите главное изображение");
  }

  if (data.gallery.length === 0) {
    warnings.push("Рекомендуется добавить фотографии в галерею");
  }

  const isComplete = !!data.coverImage;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 4: Format and Conditions
 */
function validateStep4(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.offerKind) {
    errors.push("Сначала выберите тип предложения");
    return { isValid: false, isComplete: false, errors, warnings };
  }

  // Validate based on offer kind
  if (data.offerKind === "course") {
    if (!data.classDuration || data.classDuration.trim().length === 0) {
      errors.push("Укажите продолжительность занятия");
    }
    if (!data.classFormat) {
      errors.push("Выберите формат занятия");
    }
  }

  if (data.offerKind === "birthday") {
    if (!data.partyProgram || data.partyProgram.trim().length === 0) {
      errors.push("Опишите программу праздника");
    }
    if (!data.partyDuration || data.partyDuration.trim().length === 0) {
      errors.push("Укажите продолжительность праздника");
    }
  }

  if (data.offerKind === "service") {
    if (!data.serviceDescription || data.serviceDescription.trim().length === 0) {
      errors.push("Опишите услугу");
    }
  }

  const isComplete = Boolean(
    (data.offerKind === "course" && data.classDuration.trim() && data.classFormat) ||
    (data.offerKind === "birthday" && data.partyProgram.trim() && data.partyDuration.trim()) ||
    (data.offerKind === "service" && data.serviceDescription.trim())
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 5: Pricing
 */
function validateStep5(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.pricingMode) {
    errors.push("Выберите режим ценообразования");
  }

  if (data.pricingMode === "single") {
    if (!data.singlePrice || data.singlePrice.trim().length === 0) {
      errors.push("Укажите цену");
    }
  }

  if (data.pricingMode === "multiple") {
    if (data.pricingOptions.length === 0) {
      errors.push("Добавьте хотя бы один вариант цены");
    } else {
      data.pricingOptions.forEach((option, index) => {
        if (!option.title || option.title.trim().length === 0) {
          errors.push(`Вариант ${index + 1}: укажите название`);
        }
        if (!option.price || option.price.trim().length === 0) {
          errors.push(`Вариант ${index + 1}: укажите цену`);
        }
      });
    }
  }

  const isComplete = Boolean(
    data.pricingMode &&
    ((data.pricingMode === "single" && data.singlePrice.trim()) ||
     (data.pricingMode === "multiple" && data.pricingOptions.length > 0 &&
      data.pricingOptions.every(opt => opt.title.trim() && opt.price.trim())))
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 6: Contacts (optional step)
 */
function validateStep6(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push("Некорректный номер телефона");
  }

  if (data.website && !isValidUrl(data.website)) {
    errors.push("Некорректная ссылка на сайт");
  }

  // Validate social links
  data.socialLinks.forEach((link, index) => {
    if (!link.url || link.url.trim().length === 0) {
      errors.push(`Соцсеть ${index + 1}: не указана ссылка`);
    } else if (!isValidUrl(link.url)) {
      errors.push(`Соцсеть ${index + 1}: некорректная ссылка`);
    }
  });

  // Step 7 is optional, so always complete
  const isComplete = true;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 7: CTA and Publication
 */
function validateStep7(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.ctaType) {
    errors.push("Выберите тип действия");
  }

  // Validate based on CTA type
  if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
    if (!data.ctaPhone || data.ctaPhone.trim().length === 0) {
      errors.push("Укажите телефон для связи");
    } else if (!isValidPhone(data.ctaPhone)) {
      errors.push("Некорректный номер телефона");
    }
  }

  if (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") {
    if (!data.ctaLink || data.ctaLink.trim().length === 0) {
      errors.push("Укажите ссылку");
    } else if (!isValidUrl(data.ctaLink)) {
      errors.push("Некорректная ссылка");
    }
  }

  // Validate booking settings if CTA is "забронировать"
  if (data.ctaType === "забронировать") {
    const booking = data.bookingSettings;
    
    if (!booking.mode) {
      errors.push("Выберите способ бронирования");
    }

    if (booking.mode === "request") {
      if (!booking.selectionType) {
        errors.push("Выберите что выбирает клиент");
      }
      if (!booking.availableDaysAhead || booking.availableDaysAhead < 1) {
        errors.push("Укажите на сколько дней вперёд доступна бронь");
      }
      if (!booking.capacityPerUnit || booking.capacityPerUnit < 1) {
        errors.push("Укажите количество заявок на дату/слот");
      }
    }

    if (booking.mode === "slot") {
      if (!booking.availableDaysAhead || booking.availableDaysAhead < 1) {
        errors.push("Укажите на сколько дней вперёд открыта запись");
      }
      if (!booking.slotDurationMinutes || booking.slotDurationMinutes < 15) {
        errors.push("Выберите длительность слота");
      }
      if (!booking.capacityPerUnit || booking.capacityPerUnit < 1) {
        errors.push("Укажите количество клиентов в слот");
      }
      
      // Check if at least one day is enabled with valid times
      const hasValidSchedule = booking.weeklyAvailability.some(day => 
        day.enabled && day.startTime && day.endTime
      );
      if (!hasValidSchedule) {
        errors.push("Добавьте хотя бы один день в расписание");
      }
    }

    if (booking.mode === "external") {
      if (!booking.externalUrl || booking.externalUrl.trim().length === 0) {
        errors.push("Укажите ссылку для бронирования");
      } else if (!isValidUrl(booking.externalUrl)) {
        errors.push("Некорректная ссылка для бронирования");
      }
    }
  }

  const isComplete = Boolean(
    data.ctaType &&
    ((data.ctaType === "записаться" || data.ctaType === "отправить_заявку") ? 
     (data.ctaPhone && isValidPhone(data.ctaPhone)) : true) &&
    ((data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") ? 
     (data.ctaLink && isValidUrl(data.ctaLink)) : true) &&
    (data.ctaType === "забронировать" ? validateBookingSettings(data.bookingSettings) : true)
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Validate booking settings completeness
 */
function validateBookingSettings(booking: OfferFormData["bookingSettings"]): boolean {
  if (!booking.mode) return false;
  
  if (booking.mode === "request") {
    return !!(
      booking.selectionType &&
      booking.availableDaysAhead &&
      booking.availableDaysAhead > 0 &&
      booking.capacityPerUnit &&
      booking.capacityPerUnit > 0
    );
  }
  
  if (booking.mode === "slot") {
    const hasValidSchedule = booking.weeklyAvailability.some(day => 
      day.enabled && day.startTime && day.endTime
    );
    return !!(
      booking.availableDaysAhead &&
      booking.availableDaysAhead > 0 &&
      booking.slotDurationMinutes &&
      booking.slotDurationMinutes >= 15 &&
      booking.capacityPerUnit &&
      booking.capacityPerUnit > 0 &&
      hasValidSchedule
    );
  }
  
  if (booking.mode === "external") {
    return !!(booking.externalUrl && isValidUrl(booking.externalUrl));
  }
  
  return false;
}

/**
 * Final validation for submit (strict)
 */
export function validateForSubmit(data: OfferFormData): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate all required steps
  for (let step = 1; step <= 7; step++) {
    const result = validateStep(step, data);
    if (!result.isComplete) {
      allErrors.push(`Шаг ${step}: не заполнены обязательные поля`);
    }
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    isValid: allErrors.length === 0,
    isComplete: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// Helper functions
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidPhone(phone: string): boolean {
  // Basic phone validation
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 9;
}
// Offer Wizard Validation
// Inherits Event Wizard architecture 1-to-1

import type { OfferFormData } from "./types";
import { getStepsForOfferType } from "./offerWizardSteps.config";
import { validatePublicationAccess } from "@/features/publication-access";
import { showCampLodgingFormFields } from "./campOfferModel";

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
      return validateCampScheduleStep(data);
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

  if (data.offerWizardType === "CAMP") {
    if (!data.campProgramType) {
      errors.push("Выберите тип программы лагеря");
    }
  }

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

  const campProgramOk =
    data.offerWizardType !== "CAMP" || Boolean(data.campProgramType);

  const isComplete = Boolean(
    campProgramOk &&
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
 * Step 5: Pricing and participation
 */
function validateStep5(data: OfferFormData): ValidationResult {
  const pricingErrors: string[] = [];
  const participationErrors: string[] = [];
  const warnings: string[] = [];

  if (!data.pricingMode) {
    pricingErrors.push("Выберите режим ценообразования");
  }

  if (data.pricingMode === "single") {
    if (!data.singlePrice || data.singlePrice.trim().length === 0) {
      pricingErrors.push("Укажите цену");
    }
  }

  if (data.pricingMode === "multiple") {
    if (data.pricingOptions.length === 0) {
      pricingErrors.push("Добавьте хотя бы один вариант цены");
    } else {
      data.pricingOptions.forEach((option, index) => {
        if (!option.title || option.title.trim().length === 0) {
          pricingErrors.push(`Вариант ${index + 1}: укажите название`);
        }
        if (!option.price || option.price.trim().length === 0) {
          pricingErrors.push(`Вариант ${index + 1}: укажите цену`);
        }
      });
    }
  }

  if (data.publicationAccess) {
    const result = validatePublicationAccess(data.publicationAccess);
    participationErrors.push(...Object.values(result.errors));
  } else if (!data.ctaType) {
    participationErrors.push("Выберите тип действия");
  } else {
    if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
      if (!data.ctaPhone || data.ctaPhone.trim().length === 0) {
        participationErrors.push("Укажите телефон для связи");
      } else if (!isValidPhone(data.ctaPhone)) {
        participationErrors.push("Некорректный номер телефона");
      }
    }

    if (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") {
      if (!data.ctaLink || data.ctaLink.trim().length === 0) {
        participationErrors.push("Укажите ссылку");
      } else if (!isValidUrl(data.ctaLink)) {
        participationErrors.push("Некорректная ссылка");
      }
    }

    if (data.ctaType === "забронировать" && !validateBookingSettings(data.bookingSettings)) {
      participationErrors.push("Заполните настройки бронирования");
    }
  }

  const isComplete = Boolean(
    data.pricingMode &&
    ((data.pricingMode === "single" && data.singlePrice.trim()) ||
     (data.pricingMode === "multiple" && data.pricingOptions.length > 0 &&
      data.pricingOptions.every(opt => opt.title.trim() && opt.price.trim()))) &&
    (data.publicationAccess
      ? validatePublicationAccess(data.publicationAccess).valid
      : Boolean(data.ctaType))
  );

  return {
    isValid: pricingErrors.length === 0 && participationErrors.length === 0,
    isComplete,
    errors: [...pricingErrors, ...participationErrors],
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
 * Step 4 (camp): Смены и расписание
 */
function validateCampScheduleStep(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.offerWizardType !== "CAMP") {
    return {
      isValid: true,
      isComplete: true,
      errors,
      warnings,
    };
  }

  const dated = data.campSessions.filter((session) => session.dateFrom && session.dateTo);
  if (dated.length === 0) {
    errors.push("Добавьте хотя бы одну смену с датами");
  }

  for (const session of dated) {
    if (session.dateFrom && session.dateTo && session.dateFrom > session.dateTo) {
      errors.push("Дата окончания смены не может быть раньше даты начала");
      break;
    }
  }

  const dateOrderOk = !dated.some(
    (s) => s.dateFrom && s.dateTo && s.dateFrom > s.dateTo,
  );
  const isComplete = dated.length > 0 && dateOrderOk;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

function validateAccommodationStep(data: OfferFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.offerWizardType !== "CAMP") {
    return { isValid: true, isComplete: true, errors, warnings };
  }

  if (!showCampLodgingFormFields(data)) {
    return { isValid: true, isComplete: true, errors, warnings };
  }

  if (!data.accommodationType) {
    errors.push("Укажите тип размещения");
  }
  if (!data.accommodationAddress?.trim()) {
    errors.push("Укажите адрес проживания");
  }

  const isComplete = errors.length === 0;
  return { isValid: isComplete, isComplete, errors, warnings };
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
  const steps = getStepsForOfferType(data.offerWizardType).filter(
    (step) => step.key !== "review",
  );

  for (const step of steps) {
    let result: ValidationResult;

    switch (step.key) {
      case "type":
        result = validateStep1(data);
        break;
      case "details":
        result = validateStep2(data);
        break;
      case "photo":
        result = validateStep3(data);
        break;
      case "conditions":
        result = validateStep4(data);
        break;
      case "campSchedule":
        result = validateCampScheduleStep(data);
        break;
      case "accommodation":
        result = validateAccommodationStep(data);
        break;
      case "price":
        result = validateStep5(data);
        break;
      case "contacts":
        result = validateStep6(data);
        break;
      default:
        result = { isValid: true, isComplete: true, errors: [], warnings: [] };
    }

    if (!result.isComplete) {
      allErrors.push(`Шаг "${step.title}": не заполнены обязательные поля`);
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

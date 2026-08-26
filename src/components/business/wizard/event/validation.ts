// Event Wizard Validation

import type { EventFormData } from "./types";
import { isValidE164Phone } from "@/lib/phone/e164";
import { isRichTextMeaningful, getRichTextLength } from "@/lib/richtext/utils";
import { DRAFT_REQUIRED, SUBMIT_REQUIRED } from "./types";
import { isCinemaEventCategorySlug } from "@/lib/business/eventCategoryCinema";
import { supportsDurationForCategorySlug } from "@/lib/business/eventCategoryDuration";
import { resolveScheduleItemTimeOrder } from "@/lib/event/scheduleItemTimeOrder";

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate for draft save (soft validation)
 */
export function validateForDraft(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push("Укажите название события");
  }

  if (!data.categoryId) {
    errors.push("Выберите основную категорию");
  } else if (data.primaryRootHasChildren && !data.subcategoryId) {
    errors.push("Выберите подкатегорию");
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
export function validateStep(step: number, data: EventFormData): ValidationResult {
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
      return validateStep8(data);
    case 9:
      return validateStep9(data);
    case 10:
      return validateForSubmit(data);
    default:
      return { isValid: true, isComplete: true, errors: [], warnings: [] };
  }
}

/**
 * Step 1: Basics
 */
function validateStep1(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push("Название должно содержать минимум 3 символа");
  }

  if (data.eventFormats.length === 0) {
    warnings.push("Выберите формат и атмосферу события");
  }

  if (!data.categoryId) {
    errors.push("Выберите основную категорию");
  } else if (data.primaryRootHasChildren && !data.subcategoryId) {
    errors.push("Выберите подкатегорию");
  }

  if (data.ageRangeIds.length === 0) {
    warnings.push("Выберите возраст");
  }

  // Единая длительность — для категорий с supportsDuration (см. slug-set).
  if (
    supportsDurationForCategorySlug(data.categorySlug) &&
    data.durationMinutes != null &&
    (!Number.isInteger(data.durationMinutes) ||
      data.durationMinutes < 1 ||
      data.durationMinutes > 600)
  ) {
    errors.push("Продолжительность — целое число от 1 до 600 минут");
  }

  // Cinema-specific validation (по slug выбранной категории)
  if (isCinemaEventCategorySlug(data.categorySlug)) {
    if (data.cinemaTrailerUrl) {
      if (!isValidUrl(data.cinemaTrailerUrl)) {
        errors.push("Некорректная ссылка на трейлер");
      } else if (!data.cinemaTrailerUrl.trim().toLowerCase().startsWith("https://")) {
        // Warning, не error: ранее сохранённые http-ссылки не должны
        // блокировать редактирование и публикацию.
        warnings.push("Ссылка на трейлер должна начинаться с https://");
      }
    }
  }

  const categoryOk =
    !!data.categoryId && (!data.primaryRootHasChildren || !!data.subcategoryId);

  const isComplete =
    data.title.trim().length >= 3 &&
    data.eventFormats.length > 0 &&
    categoryOk &&
    data.ageRangeIds.length > 0;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 2: Location (EventVenue)
 */
export function validateStep2(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.venueKind) {
    errors.push("Выберите способ указания локации");
  } else {
    if (data.venueKind === "PLACE") {
      if (!data.placeId) {
        errors.push("Выберите место проведения");
      }
    } else if (data.venueKind === "MANUAL") {
      const isParsedDraft =
        data.pendingLocation?.mode === "PARSED_LOCATION" &&
        data.pendingLocation.source === "parser";
      if (!data.venueName || data.venueName.trim().length === 0) {
        errors.push("Укажите название площадки");
      }
      if (!isParsedDraft && (!data.address || data.address.trim().length === 0)) {
        errors.push("Укажите адрес");
      }
      if (!data.city || data.city.trim().length === 0) {
        errors.push("Укажите город");
      }
    }
    // MOBILE and TBD don't require additional fields
  }

  const isComplete = Boolean(
    data.venueKind &&
    (data.venueKind === "PLACE" ? data.placeId : true) &&
    (data.venueKind === "MANUAL"
      ? data.pendingLocation?.mode === "PARSED_LOCATION" &&
        data.pendingLocation.source === "parser"
        ? data.venueName.trim() && data.city.trim()
        : data.venueName.trim() && data.address.trim() && data.city.trim()
      : true)
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 3: Description
 */
function validateStep3(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate fullDescription (now HTML from TipTap)
  if (!isRichTextMeaningful(data.fullDescription)) {
    errors.push("Описание обязательно для заполнения");
  } else {
    const textLength = getRichTextLength(data.fullDescription);
    if (textLength < 20) {
      errors.push("Описание должно содержать минимум 20 символов");
    }
  }

  const isComplete = isRichTextMeaningful(data.fullDescription) && 
    getRichTextLength(data.fullDescription) >= 20;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 4: Media
 */
function validateStep4(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.coverImage) {
    errors.push("Загрузите главное изображение");
  }

  if (data.reelsUrl && !isValidUrl(data.reelsUrl)) {
    errors.push("Некорректная ссылка на видео");
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
 * Step 5: Schedule
 * MVP: all dates use common time
 */
function validateStep5(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.dates.length === 0) {
    errors.push("Добавьте хотя бы одну дату проведения");
  }

  // Validate time if not all day
  if (!data.allDay) {
    if (!data.startTime) {
      errors.push("Укажите время начала");
    }
    if (!data.endTime) {
      errors.push("Укажите время окончания");
    }
  }

  // Time order per date card: endTime < startTime means the event ends after
  // midnight the next day (e.g. 20:00 → 02:00), not an error — see
  // resolveScheduleItemTimeOrder for the canonical date+time interpretation.
  // endTime === startTime stays an error (not treated as a 24h event).
  const scheduleItems = Array.isArray(data.scheduleItems) ? data.scheduleItems : [];
  if (data.schedulingKind === "SLOT") {
    const hasValidDuration = Number.isInteger(data.durationMinutes) &&
      (data.durationMinutes ?? 0) >= 1 && (data.durationMinutes ?? 0) <= 600;
    const incompleteSlot = scheduleItems.some(
      (item) => item.allDay || !item.startTime || (!item.endTime && !hasValidDuration),
    );
    if (incompleteSlot) {
      errors.push("Для события в конкретное время укажите время начала и окончания или продолжительность");
    }
  }
  for (const item of scheduleItems) {
    const order = resolveScheduleItemTimeOrder(item);
    if (!order.isValid) {
      errors.push(
        item.date
          ? `Время окончания должно отличаться от времени начала (дата ${item.date})`
          : "Время окончания должно отличаться от времени начала",
      );
    }
  }

  // Recurring validation
  if (data.repeatEnabled) {
    if (!data.repeatUnit) {
      errors.push("Выберите частоту повторения");
    }
    if (!data.repeatUntil) {
      errors.push("Укажите дату окончания повторений");
    }
  }

  const isComplete = 
    data.dates.length > 0 &&
    Boolean(data.allDay || (data.startTime && data.endTime));

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 6: Pricing & Participation
 */
function validateStep6(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate pricing mode
  if (!data.pricingMode) {
    errors.push("Выберите режим стоимости");
  } else {
    // If paid, validate price
    if ((data.pricingMode === "fixed" || data.pricingMode === "from")) {
      if (!data.price || data.price.trim().length === 0) {
        errors.push("Укажите стоимость");
      }
    }
  }

  // Validate participation mode
  if (!data.participationMode) {
    errors.push("Выберите формат участия");
  } else {
    // Validate based on participation mode
    if (data.participationMode === "external-link") {
      if (!data.ticketLink || data.ticketLink.trim().length === 0) {
        errors.push("Укажите ссылку на покупку билетов");
      } else if (!isValidUrl(data.ticketLink)) {
        errors.push("Некорректная ссылка на покупку билетов");
      }
    }

    if (data.participationMode === "time-slots") {
      const hasSlots = data.timeSlots?.dates?.some(d => d.slots.length > 0);
      if (!hasSlots) {
        errors.push("Добавьте хотя бы одну дату со слотами");
      }
    }

    if (data.participationMode === "prebook") {
      if (!data.prebookMethod) {
        errors.push("Выберите способ предварительной записи");
      } else if (data.prebookMethod === "phone") {
        if (!data.prebookPhone || data.prebookPhone.trim().length === 0) {
          errors.push("Укажите телефон для записи");
        } else if (!isValidPhone(data.prebookPhone)) {
          errors.push("Некорректный телефон для записи");
        }
      } else if (data.prebookMethod === "link") {
        if (!data.prebookUrl || data.prebookUrl.trim().length === 0) {
          errors.push("Укажите ссылку на запись");
        } else if (!isValidUrl(data.prebookUrl)) {
          errors.push("Некорректная ссылка на запись");
        }
      }
    }
  }

  // Validate CTA type - removed, now auto-determined from participationMode

  const isComplete = Boolean(
    data.pricingMode &&
    ((data.pricingMode === "fixed" || data.pricingMode === "from") ? data.price?.trim() : true) &&
    data.participationMode &&
    (data.participationMode === "external-link" ? data.ticketLink?.trim() : true) &&
    (data.participationMode === "time-slots" ? data.timeSlots?.dates?.some(d => d.slots.length > 0) : true) &&
    (data.participationMode === "prebook"
      ? data.prebookMethod === "phone"
        ? Boolean(data.prebookPhone?.trim())
        : data.prebookMethod === "link"
          ? Boolean(data.prebookUrl?.trim())
          : false
      : true)
  );

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Step 7: Contacts (optional step)
 */
function validateStep7(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push("Введите корректный номер телефона");
  }

  if (data.website && !isValidUrl(data.website)) {
    errors.push("Некорректная ссылка на сайт");
  }

  // Пустые строки (только платформа) не ошибка; проверяем только заполненные URL
  data.socialLinks.forEach((link, index) => {
    const url = link.url?.trim() ?? "";
    if (url.length === 0) return;
    if (!isValidUrl(url)) {
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
 * Step 8: Organizer (optional step)
 *
 * Организатор необязателен: полностью пустой шаг 8 валиден и завершён.
 * Проверки формата (УНП/телефон/сайт/Instagram) выдаются только как warnings
 * и только когда соответствующее поле непустое — они никогда не блокируют
 * переход дальше или публикацию.
 */
function validateStep8(data: EventFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.organizerUnp && !/^\d{9}$/.test(data.organizerUnp)) {
    warnings.push("УНП должен содержать 9 цифр");
  }

  if (data.organizerPhone && !isValidPhone(data.organizerPhone)) {
    warnings.push("Введите корректный номер телефона");
  }

  if (data.organizerWebsite && !isValidUrl(data.organizerWebsite)) {
    warnings.push("Проверьте формат веб-сайта");
  }

  if (
    data.organizerInstagram &&
    !isValidUrl(data.organizerInstagram) &&
    !data.organizerInstagram.trim().startsWith("@")
  ) {
    warnings.push("Проверьте формат Instagram");
  }

  // Optional step — always complete, never blocks navigation/publishing.
  const isComplete = true;

  return {
    isValid: errors.length === 0,
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Final validation for submit (strict)
 */
export function validateForSubmit(data: EventFormData): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate all required steps
  for (let step = 1; step <= 9; step++) {
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

function validateStep9(data: EventFormData): ValidationResult {
  void data;
  return { isValid: true, isComplete: true, errors: [], warnings: [] };
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
  return isValidE164Phone(phone);
}

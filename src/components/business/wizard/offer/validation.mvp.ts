// Offer Wizard MVP Validation
// Strict validation for quality content

import type { OfferFormDataMVP } from "./types.mvp";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate for DRAFT save
 * Minimum required fields
 */
export function validateForDraftMVP(data: OfferFormDataMVP): ValidationResult {
  const errors: Record<string, string> = {};
  
  if (!data.offerKind) {
    errors.offerKind = "Выберите тип предложения";
  }
  
  if (!data.title || data.title.trim().length < 3) {
    errors.title = "Название должно быть не менее 3 символов";
  }
  
  if (!data.placeId) {
    errors.placeId = "Выберите место";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate for SUBMIT (moderation)
 * All required fields must be filled
 */
export function validateForSubmitMVP(data: OfferFormDataMVP): ValidationResult {
  const errors: Record<string, string> = {};
  
  // Step 1: Offer Type
  if (!data.offerKind) {
    errors.offerKind = "Выберите тип предложения";
  }
  
  // Step 2: Basic Information
  if (!data.title || data.title.trim().length < 3) {
    errors.title = "Название должно быть не менее 3 символов";
  }
  
  if (!data.description || data.description.trim().length < 20) {
    errors.description = "Описание должно быть не менее 20 символов";
  }
  
  if (!data.placeId) {
    errors.placeId = "Выберите место";
  }
  
  // Step 3: Audience and Signals
  if (!data.ageMinMonths || data.ageMinMonths < 0) {
    errors.ageMinMonths = "Укажите минимальный возраст";
  }
  
  if (!data.ageMaxMonths || data.ageMaxMonths < 0) {
    errors.ageMaxMonths = "Укажите максимальный возраст";
  }
  
  if (data.ageMinMonths && data.ageMaxMonths && data.ageMinMonths > data.ageMaxMonths) {
    errors.ageRange = "Минимальный возраст не может быть больше максимального";
  }
  
  // Activity signals (required, min 1, max 3)
  if (data.activitySignals.length === 0) {
    errors.activitySignals = "Выберите хотя бы одну активность";
  }
  if (data.activitySignals.length > 3) {
    errors.activitySignals = "Максимум 3 активности";
  }
  
  // Format signals (required, min 1, max 2)
  if (data.formatSignals.length === 0) {
    errors.formatSignals = "Выберите хотя бы один формат";
  }
  if (data.formatSignals.length > 2) {
    errors.formatSignals = "Максимум 2 формата";
  }
  
  // Participation signals (required, exactly 1)
  if (data.participationSignals.length === 0) {
    errors.participationSignals = "Выберите тип участия";
  }
  if (data.participationSignals.length > 1) {
    errors.participationSignals = "Выберите только один тип участия";
  }
  
  // Intention signals (optional, max 2)
  if (data.intentionSignals.length > 2) {
    errors.intentionSignals = "Максимум 2 намерения";
  }
  
  // Feature signals (optional, max 3)
  if (data.featureSignals.length > 3) {
    errors.featureSignals = "Максимум 3 особенности";
  }
  
  // Step 4: Price and CTA
  if (!data.priceFrom || data.priceFrom <= 0) {
    errors.priceFrom = "Укажите цену";
  }
  
  if (!data.ctaType) {
    errors.ctaType = "Выберите действие";
  }
  
  // At least one contact method required
  const hasPhone = data.ctaPhone && data.ctaPhone.trim().length > 0;
  const hasLink = data.ctaLink && data.ctaLink.trim().length > 0;
  
  if (!hasPhone && !hasLink) {
    errors.ctaContact = "Укажите телефон или ссылку для связи";
  }
  
  // Validate contact based on CTA type
  if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
    if (!hasPhone) {
      errors.ctaPhone = "Укажите телефон для связи";
    }
  }
  
  if (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") {
    if (!hasLink) {
      errors.ctaLink = "Укажите ссылку";
    }
  }
  
  // Step 5: Media
  if (!data.coverImage) {
    errors.coverImage = "Загрузите главное изображение";
  }
  
  if (data.gallery.length === 0) {
    errors.gallery = "Добавьте хотя бы одно изображение в галерею";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate specific step
 */
export function validateStepMVP(
  stepId: number,
  data: OfferFormDataMVP
): ValidationResult {
  const errors: Record<string, string> = {};
  
  switch (stepId) {
    case 1: // Offer Type
      if (!data.offerKind) {
        errors.offerKind = "Выберите тип предложения";
      }
      break;
      
    case 2: // Basic Information
      if (!data.title || data.title.trim().length < 3) {
        errors.title = "Название должно быть не менее 3 символов";
      }
      if (!data.description || data.description.trim().length < 20) {
        errors.description = "Описание должно быть не менее 20 символов";
      }
      if (!data.placeId) {
        errors.placeId = "Выберите место";
      }
      break;
      
    case 3: // Audience and Signals
      if (!data.ageMinMonths || data.ageMinMonths < 0) {
        errors.ageMinMonths = "Укажите минимальный возраст";
      }
      if (!data.ageMaxMonths || data.ageMaxMonths < 0) {
        errors.ageMaxMonths = "Укажите максимальный возраст";
      }
      if (data.activitySignals.length === 0) {
        errors.activitySignals = "Выберите хотя бы одну активность";
      }
      if (data.formatSignals.length === 0) {
        errors.formatSignals = "Выберите хотя бы один формат";
      }
      if (data.participationSignals.length === 0) {
        errors.participationSignals = "Выберите тип участия";
      }
      break;
      
    case 4: // Price and CTA
      if (!data.priceFrom || data.priceFrom <= 0) {
        errors.priceFrom = "Укажите цену";
      }
      if (!data.ctaType) {
        errors.ctaType = "Выберите действие";
      }
      const hasPhone = data.ctaPhone && data.ctaPhone.trim().length > 0;
      const hasLink = data.ctaLink && data.ctaLink.trim().length > 0;
      if (!hasPhone && !hasLink) {
        errors.ctaContact = "Укажите телефон или ссылку";
      }
      break;
      
    case 5: // Media
      if (!data.coverImage) {
        errors.coverImage = "Загрузите главное изображение";
      }
      if (data.gallery.length === 0) {
        errors.gallery = "Добавьте хотя бы одно изображение";
      }
      break;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if step is complete (can proceed to next)
 */
export function isStepCompleteMVP(
  stepId: number,
  data: OfferFormDataMVP
): boolean {
  const validation = validateStepMVP(stepId, data);
  return validation.isValid;
}

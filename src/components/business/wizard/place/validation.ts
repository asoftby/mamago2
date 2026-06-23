import type { PlaceFormData, StepValidation } from "./types";

export function validateStep1(data: PlaceFormData): StepValidation {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) errors.push("Название обязательно");
  if (!data.category) errors.push("Категория обязательна");
  if (!data.primaryCategoryId) errors.push("Выберите основную категорию");
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
  if (!data.ageTags || data.ageTags.length === 0) errors.push("Выберите хотя бы один возраст");
  if (!data.visitFormats || data.visitFormats.length === 0) {
    errors.push("Выберите хотя бы один формат посещения");
  }

  return { isValid: errors.length === 0, isComplete: errors.length === 0, errors };
}

export function validateStep2(data: PlaceFormData): StepValidation {
  const errors: string[] = [];

  if (data.lat === null || data.lng === null) {
    errors.push("Укажите местоположение на карте");
  }

  return { isValid: errors.length === 0, isComplete: errors.length === 0, errors };
}

export function validateStep3(data: PlaceFormData): StepValidation {
  const hasAnyContact = !!(
    data.phone ||
    data.phone2 ||
    data.phone3 ||
    data.website ||
    data.instagramHandle
  );

  return {
    isValid: true,
    isComplete: hasAnyContact,
    errors: [],
  };
}

export function validateStep4(data: PlaceFormData): StepValidation {
  const errors: string[] = [];
  const hasLogo =
    !!data.logoImageId ||
    data.images.some((img) => img.kind === "LOGO" && !!img.url?.trim());
  const hasGalleryImages = data.images.length > 0;

  if (!hasLogo && !hasGalleryImages) {
    errors.push("Добавьте хотя бы одно фото (логотип или галерею)");
  }

  return { isValid: errors.length === 0, isComplete: errors.length === 0, errors };
}

export function validateStep5(data: PlaceFormData): StepValidation {
  const hasOpeningHours = !!data.openingHoursData && (
    data.openingHoursData.mode === "ALWAYS_OPEN" ||
    data.openingHoursData.mode === "BY_APPOINTMENT" ||
    data.openingHoursData.mode === "TEMPORARILY_CLOSED" ||
    (data.openingHoursData.mode === "WEEKLY" &&
      data.openingHoursData.rules.some(
        (rule) => rule.isOpen && rule.intervals && rule.intervals.length > 0,
      ))
  );

  return {
    isValid: true,
    isComplete: hasOpeningHours,
    errors: [],
  };
}

export function validateStep6(data: PlaceFormData): StepValidation {
  void data;
  return {
    isValid: true,
    isComplete: true,
    errors: [],
  };
}

export function validateStep7(data: PlaceFormData): StepValidation {
  const step1 = validateStep1(data);
  const step2 = validateStep2(data);
  const step4 = validateStep4(data);
  const allRequiredComplete = step1.isComplete && step2.isComplete && step4.isComplete;

  return {
    isValid: allRequiredComplete,
    isComplete: allRequiredComplete,
    errors: allRequiredComplete ? [] : ["Заполните все обязательные шаги"],
  };
}

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
    case 7:
      return validateStep7(data);
    default:
      return { isValid: false, isComplete: false, errors: ["Invalid step"] };
  }
}

export function isStepComplete(step: number, data: PlaceFormData): boolean {
  return validateStep(step, data).isComplete;
}

export function validateForSubmit(data: PlaceFormData): StepValidation {
  const step1 = validateStep1(data);
  const step2 = validateStep2(data);
  const step4 = validateStep4(data);
  const allErrors = [...step1.errors, ...step2.errors, ...step4.errors];

  return {
    isValid: allErrors.length === 0,
    isComplete: allErrors.length === 0,
    errors: allErrors,
  };
}

export function canGoToNextStep(currentStep: number, data: PlaceFormData): boolean {
  void data;
  return currentStep < 7;
}

export function canGoToPrevStep(currentStep: number): boolean {
  return currentStep > 1;
}

export function canGoToStep(targetStep: number, currentStep: number, data: PlaceFormData): boolean {
  void currentStep;
  void data;
  return targetStep >= 1 && targetStep <= 7;
}

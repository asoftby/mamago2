// Offer Wizard MVP Types
// Simplified for 2-3 minute creation flow

export type OfferWizardMode = "create" | "edit";

/**
 * MVP Offer Form Data
 * Focused on essential fields only
 */
export interface OfferFormDataMVP {
  // Step 1: Offer Type
  offerKind: "course" | "birthday" | "service" | null;
  
  // Step 2: Basic Information
  title: string;
  description: string; // No character limit
  placeId: string | null;
  
  // Step 3: Audience and Signals
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  
  // Signals (REQUIRED)
  activitySignals: string[]; // min 1, max 3
  formatSignals: string[];    // min 1, max 2
  participationSignals: string[]; // exactly 1
  
  // Signals (OPTIONAL - collapsed by default)
  intentionSignals: string[]; // max 2
  featureSignals: string[];   // max 3
  
  // Step 4: Price and CTA
  priceFrom: number | null;
  priceText: string; // optional, collapsed
  ctaType: "записаться" | "забронировать" | "купить_билет" | "отправить_заявку" | "перейти_на_сайт" | null;
  ctaPhone: string;
  ctaLink: string;
  
  // Step 5: Media and Publication
  coverImage: string | null;
  gallery: string[]; // min 1 image required
}

/**
 * Signal options for each group
 */
export const SIGNAL_OPTIONS = {
  activity: [
    { value: "educational", label: "Обучение", icon: "📚" },
    { value: "creative", label: "Творчество", icon: "🎨" },
    { value: "active", label: "Активность", icon: "⚽" },
    { value: "calm", label: "Спокойное", icon: "🧘" },
    { value: "entertainment", label: "Развлечение", icon: "🎭" },
    { value: "social", label: "Общение", icon: "👥" },
    { value: "food", label: "Еда", icon: "🍰" },
  ],
  format: [
    { value: "indoor", label: "В помещении", icon: "🏠" },
    { value: "outdoor", label: "На улице", icon: "🌳" },
    { value: "online", label: "Онлайн", icon: "💻" },
    { value: "hybrid", label: "Гибрид", icon: "🔄" },
  ],
  participation: [
    { value: "individual", label: "Индивидуально", icon: "👤" },
    { value: "group", label: "Группа", icon: "👥" },
    { value: "family", label: "Семья", icon: "👨‍👩‍👧" },
  ],
  intention: [
    { value: "family-time", label: "Семейное время", icon: "❤️" },
    { value: "active-time", label: "Активный отдых", icon: "🏃" },
    { value: "relax", label: "Отдых", icon: "😌" },
    { value: "explore", label: "Исследование", icon: "🔍" },
    { value: "eat", label: "Поесть", icon: "🍽️" },
    { value: "walk", label: "Прогулка", icon: "🚶" },
  ],
  features: [
    { value: "free", label: "Бесплатно", icon: "🆓" },
    { value: "paid", label: "Платно", icon: "💰" },
    { value: "booking-required", label: "Нужна запись", icon: "📅" },
    { value: "age-restricted", label: "Возрастное ограничение", icon: "🔞" },
  ],
} as const;

/**
 * Auto-suggestions based on offer kind
 */
export const AUTO_SUGGESTIONS = {
  course: {
    activity: ["educational", "creative"],
    format: ["indoor"],
    participation: ["group"],
    ctaType: "записаться" as const,
  },
  birthday: {
    activity: ["entertainment", "social"],
    format: ["indoor"],
    participation: ["group"],
    ctaType: "отправить_заявку" as const,
  },
  service: {
    activity: ["entertainment"],
    format: ["indoor"],
    participation: ["individual"],
    ctaType: "отправить_заявку" as const,
  },
} as const;

/**
 * Draft validation rules (soft)
 * Minimum required to save as draft
 */
export const DRAFT_REQUIRED_MVP = {
  offerKind: true,
  title: true,
  placeId: true,
} as const;

/**
 * Submit validation rules (strict)
 * Required for moderation submission
 */
export const SUBMIT_REQUIRED_MVP = {
  // Step 1
  offerKind: true,
  
  // Step 2
  title: true,
  description: true,
  placeId: true,
  
  // Step 3
  ageMinMonths: true,
  ageMaxMonths: true,
  activitySignals: { min: 1, max: 3 },
  formatSignals: { min: 1, max: 2 },
  participationSignals: { exactly: 1 },
  
  // Step 4
  priceFrom: true,
  ctaType: true,
  ctaPhone_or_ctaLink: true, // at least one
  
  // Step 5
  coverImage: true,
  gallery: { min: 1 }, // at least 1 image
} as const;

/**
 * Helper to get default form data
 */
export function getDefaultFormDataMVP(): OfferFormDataMVP {
  return {
    offerKind: null,
    title: "",
    description: "",
    placeId: null,
    ageMinMonths: null,
    ageMaxMonths: null,
    activitySignals: [],
    formatSignals: [],
    participationSignals: [],
    intentionSignals: [],
    featureSignals: [],
    priceFrom: null,
    priceText: "",
    ctaType: null,
    ctaPhone: "",
    ctaLink: "",
    coverImage: null,
    gallery: [],
  };
}

/**
 * Check if form has meaningful content for autosave
 */
export function hasMeaningfulContentMVP(data: OfferFormDataMVP): boolean {
  return Boolean(
    data.offerKind ||
    data.title.trim() ||
    data.description.trim() ||
    data.placeId
  );
}

/**
 * Apply auto-suggestions based on offer kind
 */
export function applyAutoSuggestions(
  offerKind: "course" | "birthday" | "service"
): Partial<OfferFormDataMVP> {
  const suggestions = AUTO_SUGGESTIONS[offerKind];
  
  return {
    activitySignals: [...suggestions.activity],
    formatSignals: [...suggestions.format],
    participationSignals: [...suggestions.participation],
    ctaType: suggestions.ctaType,
  };
}

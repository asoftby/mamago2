import type {
  BirthdayOffer,
  BirthdayAgeGroup,
  BirthdayGuestsGroup,
  BirthdayBudgetGroup,
  BirthdayTheme,
} from "../../types/birthday";

// ─── Builder-specific types ──────────────────────────────────────────────────

export type PlaceType = "HOME" | "VENUE" | "OUTDOOR" | "PACKAGE";

export type BuilderStep =
  | "intro"         // child + age
  | "theme"         // party theme (after child; optional)
  | "budget"        // budget only
  | "place"         // place type + venue selection
  | "extras"        // guests (optional)
  | "entertainment" // animators / shows (optional)
  | "food"          // cakes / food (optional)
  | "decor"         // decor / addons (optional)
  | "summary"       // assembled party
  | "confirm";      // confirm which businesses to send requests to

export type ConflictReason =
  | "VENUE_MISMATCH"
  | "FORMAT_MISMATCH"
  | "EXCLUSIVE_TO_PREVIOUS_BASE"
  | "BUDGET_MISMATCH"
  | "AGE_MISMATCH"
  | "GUESTS_MISMATCH";

export type OfferConflict = {
  offerId: string;
  reason: ConflictReason;
  message: string;
};

// ─── Builder state ───────────────────────────────────────────────────────────

/** Ребёнок, для которого собираем праздник (опционально, не блокирует шаги) */
export type PartyForChild = {
  /** id из профиля; null если только в конструкторе или гость */
  profileChildId: string | null;
  name: string;
  /** Подпись для UI, напр. «5 лет» */
  ageLabel: string;
  /** YYYY-MM-DD — возраст и маппинг age signal */
  birthDateIso: string;
  /** Slugs из SYSTEM_INTERESTS — персонализация ранжирования */
  interestSlugs: string[];
};

/** Откуда взяты возраст и интересы для сценария (после логина — синхронизация с профилем) */
export type ScenarioFieldSource = "manual" | "child";

export type BuilderQuizInputs = {
  /** Для кого праздник — выбор из профиля или быстрое добавление */
  partyForChild: PartyForChild | null;
  /** Откуда активный возраст сценария (ручной до логина / из карточки ребёнка) */
  ageSource: ScenarioFieldSource;
  /** Откуда активные интересы для подбора */
  interestsSource: ScenarioFieldSource;
  /** Derived bucket for filters / offers (from selected age signal) */
  ageGroup: BirthdayAgeGroup | null;
  /** Source of truth: `SignalOption.id` from taxonomy `signals.age` */
  selectedAgeSignalId: string | null;
  /** Подпись как на кнопке (taxonomy `label` / chip); единый текст в чипах и sticky bar */
  selectedAgeLabel: string | null;
  budgetGroup: BirthdayBudgetGroup | null;
  guestsGroup: BirthdayGuestsGroup | null;
  theme: BirthdayTheme | null;
  placeType: PlaceType | null;
};

export type BuilderSelection = {
  /** The chosen base offer (venue or package) */
  selectedBaseId: string | null;
  /** All chosen addon offer IDs */
  selectedAddonIds: string[];
};

export type BuilderValidation = {
  /** Offers that conflict with current base */
  conflicts: OfferConflict[];
};

export type BuilderUI = {
  currentStep: BuilderStep;
};

/** Желаемая дата и время праздника (заполняется на шаге подтверждения) */
export type PartyPlanning = {
  /** YYYY-MM-DD */
  dateIso: string | null;
  /** HH:mm */
  timeStart: string | null;
  timeEnd: string | null;
};

export type BirthdayBuilderState = {
  quiz: BuilderQuizInputs;
  selection: BuilderSelection;
  validation: BuilderValidation;
  ui: BuilderUI;
  partyPlanning: PartyPlanning;
};

// ─── Request targets ─────────────────────────────────────────────────────────

export type RequestTarget = {
  businessId: string;
  businessName: string;
  offerId: string;
  offerTitle: string;
  selected: boolean;
};

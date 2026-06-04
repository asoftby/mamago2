import type {
  BirthdayOffer,
  BirthdayAgeGroup,
  BirthdayGuestsGroup,
  BirthdayBudgetGroup,
  BirthdayTheme,
} from "../../types/birthday";
import type { ScenarioItemSchedule } from "../lib/scheduleUtils";

// ─── Builder-specific types ──────────────────────────────────────────────────

export type PlaceType = "HOME" | "VENUE" | "OUTDOOR" | "PACKAGE";

export type BuilderStep =
  | "when"          // date range picker
  | "who"           // child + age + guests + theme
  | "format"        // place format + budget
  | "pick"          // pick vendors (venue + animator + food + decor)
  | "done"          // summary + time + submit
  // legacy steps kept for compatibility with draft storage
  | "intro"
  | "theme"
  | "budget"
  | "place"
  | "extras"
  | "entertainment"
  | "food"
  | "decor"
  | "summary"
  | "confirm";

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
export type ThemeSelectionSource = "auto" | "manual" | null;

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
  themeSelectionSource: ThemeSelectionSource;
  placeType: PlaceType | null;
  /** Step 1: selected date range (YYYY-M-D keys) */
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
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
  /** HH:mm — глобальное время начала (пресет для автозаполнения) */
  timeStart: string | null;
  timeEnd: string | null;
  /** Длительность брони площадки в часах; дефолтно 3 */
  selectedVenueBookingDurationHours: number;
  /** Индивидуальное расписание каждой позиции сценария */
  itemSchedules: Record<string, ScenarioItemSchedule>;
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

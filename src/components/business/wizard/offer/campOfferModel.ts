import type { CampLodgingTypeKey, CampMealKey, CampSessionEntry, CampSessionKind, OfferFormData } from "./types";

export function newCampSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `camp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyCampSession(sortOrder: number): CampSessionEntry {
  return {
    id: newCampSessionId(),
    sortOrder,
    title: "",
    dateFrom: null,
    dateTo: null,
    timeFrom: null,
    timeTo: null,
    sessionKind: "day",
    ageFrom: null,
    ageTo: null,
    capacity: null,
    spotsLeft: null,
    priceOverride: "",
    description: "",
    promotionDetails: "",
  };
}

export function campImpliesLodging(
  programType: OfferFormData["campProgramType"],
): boolean {
  return programType === "выездной" || programType === "смешанный";
}

export function showCampLodgingFormFields(data: OfferFormData): boolean {
  return campImpliesLodging(data.campProgramType) || data.accommodationProvided;
}

export function normalizeCampSessionRecord(raw: unknown, index: number): CampSessionEntry {
  const base = createEmptyCampSession(index);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const id = typeof o.id === "string" && o.id ? o.id : base.id;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : index;

  const pickStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v : v === null ? null : typeof v === "string" ? v || null : null;

  const pickOptStr = (v: unknown): string | null =>
    v === null || v === undefined
      ? null
      : typeof v === "string"
        ? v || null
        : null;

  const sessionKindRaw = o.sessionKind;
  let sessionKind: CampSessionKind = "day";
  if (
    sessionKindRaw === "day" ||
    sessionKindRaw === "full_day" ||
    sessionKindRaw === "residential"
  ) {
    sessionKind = sessionKindRaw;
  }

  const ageFrom =
    typeof o.ageFrom === "number" && Number.isFinite(o.ageFrom) ? o.ageFrom : null;
  const ageTo =
    typeof o.ageTo === "number" && Number.isFinite(o.ageTo) ? o.ageTo : null;
  const capacity =
    typeof o.capacity === "number" && Number.isFinite(o.capacity) ? o.capacity : null;
  const spotsLeft =
    typeof o.spotsLeft === "number" && Number.isFinite(o.spotsLeft)
      ? o.spotsLeft
      : null;

  return {
    id,
    sortOrder,
    title: typeof o.title === "string" ? o.title : "",
    dateFrom: pickStr(o.dateFrom),
    dateTo: pickStr(o.dateTo),
    timeFrom: pickOptStr(o.timeFrom),
    timeTo: pickOptStr(o.timeTo),
    sessionKind,
    ageFrom,
    ageTo,
    capacity,
    spotsLeft,
    priceOverride: typeof o.priceOverride === "string" ? o.priceOverride : "",
    description: typeof o.description === "string" ? o.description : "",
    promotionDetails:
      typeof o.promotionDetails === "string" ? o.promotionDetails : "",
  };
}

export function normalizeCampSessionsFromDb(raw: unknown): CampSessionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => normalizeCampSessionRecord(item, index));
}

export function sortCampSessions(entries: CampSessionEntry[]): CampSessionEntry[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function formatCampShiftDateRangeRu(
  dateFrom: string | null,
  dateTo: string | null,
): string | null {
  if (!dateFrom || !dateTo) return null;
  const a = new Date(`${dateFrom}T12:00:00`);
  const b = new Date(`${dateTo}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;

  const m1 = a.getMonth();
  const m2 = b.getMonth();
  const y1 = a.getFullYear();
  const y2 = b.getFullYear();
  const d1 = a.getDate();
  const d2 = b.getDate();

  if (m1 === m2 && y1 === y2) {
    const month = a.toLocaleDateString("ru-RU", { month: "long" });
    return `${d1}–${d2} ${month}`;
  }

  const leftLong = a.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const rightLong = b.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  if (y1 === y2) {
    return `${leftLong} – ${rightLong}`;
  }
  const left = a.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const right = b.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `${left} – ${right}`;
}

export const CAMP_SESSION_KIND_LABELS: Record<CampSessionKind, string> = {
  day: "Дневной",
  full_day: "Полный день",
  residential: "С проживанием",
};

export const CAMP_LODGING_TYPE_OPTIONS: Array<{ value: CampLodgingTypeKey; label: string }> = [
  { value: "hotel", label: "Гостиница" },
  { value: "resort_base", label: "База отдыха" },
  { value: "camping", label: "Кемпинг" },
  { value: "cottage", label: "Коттедж" },
  { value: "sanatorium", label: "Санаторий" },
  { value: "other", label: "Другое" },
];

export const CAMP_MEAL_OPTIONS: Array<{ value: CampMealKey; label: string }> = [
  { value: "breakfast", label: "Завтрак" },
  { value: "lunch", label: "Обед" },
  { value: "dinner", label: "Ужин" },
  { value: "snacks", label: "Перекусы" },
];

export function normalizeCampMealsFromDb(raw: unknown): CampMealKey[] {
  if (!Array.isArray(raw)) return [];
  const allowed: CampMealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
  return raw.filter((x): x is CampMealKey => typeof x === "string" && allowed.includes(x as CampMealKey));
}

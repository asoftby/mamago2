export type WeekRule = { weekday: number; startMinutes: number; endMinutes: number };
export type DateException = {
  date: string;
  kind: "CLOSED" | "OPEN_OVERRIDE";
  startMinutes: number | null;
  endMinutes: number | null;
};
export type UnitSummary = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  capacity: number | null;
  rules: WeekRule[];
  offers: Array<{ offerId: string }>;
};
export type UnitDetail = UnitSummary & {
  updatedAt: string;
  prepMinutes: number;
  cleanupMinutes: number;
  minDurationMinutes: number | null;
  stepMinutes: number;
  exceptions: Array<Omit<DateException, "date"> & { date: string }>;
};
export type UnitForm = {
  name: string;
  capacity: string;
  prepMinutes: string;
  cleanupMinutes: string;
  minDurationMinutes: string;
  stepMinutes: string;
  offerIds: string[];
  rules: WeekRule[];
  exceptions: DateException[];
  status: "ACTIVE" | "INACTIVE";
  expectedUpdatedAt?: string;
};
export const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export function emptyUnitForm(): UnitForm {
  return {
    name: "", capacity: "", prepMinutes: "0", cleanupMinutes: "0",
    minDurationMinutes: "", stepMinutes: "30", status: "ACTIVE",
    offerIds: [],
    rules: [1, 2, 3, 4, 5].map(weekday => ({
      weekday, startMinutes: 600, endMinutes: 1080,
    })),
    exceptions: [],
  };
}

export function fromUnitDetail(unit: UnitDetail): UnitForm {
  return {
    name: unit.name, capacity: unit.capacity?.toString() ?? "",
    prepMinutes: String(unit.prepMinutes),
    cleanupMinutes: String(unit.cleanupMinutes),
    minDurationMinutes: unit.minDurationMinutes?.toString() ?? "",
    stepMinutes: String(unit.stepMinutes),
    status: unit.status,
    expectedUpdatedAt: unit.updatedAt,
    offerIds: unit.offers.map(item => item.offerId),
    rules: [...unit.rules].sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes),
    exceptions: unit.exceptions.map(item => ({
      ...item, date: item.date.slice(0, 10),
    })),
  };
}
export function asTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return String(hours).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}
/** HTML time inputs are local wall-clock values, never Date/UTC instants. */
export function asMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return -1;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function toUnitPayload(form: UnitForm) {
  const nonnegativeInt = (value: string) => Number(value.trim());
  return {
    name: form.name.trim(),
    capacity: form.capacity.trim() ? nonnegativeInt(form.capacity) : null,
    prepMinutes: nonnegativeInt(form.prepMinutes),
    cleanupMinutes: nonnegativeInt(form.cleanupMinutes),
    minDurationMinutes: form.minDurationMinutes.trim() ? nonnegativeInt(form.minDurationMinutes) : null,
    stepMinutes: nonnegativeInt(form.stepMinutes),
    offerIds: form.offerIds,
    rules: form.rules,
    ...(form.expectedUpdatedAt ? {
      expectedUpdatedAt: form.expectedUpdatedAt,
      status: form.status,
      exceptions: form.exceptions,
    } : {}),
  };
}

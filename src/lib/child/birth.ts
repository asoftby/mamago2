import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

export type ChildBirthPrecision = "DAY" | "MONTH";

export type ChildBirthInput =
  | { precision: "DAY"; date: string }
  | { precision: "MONTH"; year: number; month: number };

export type StoredChildBirth = {
  birthDate: Date;
  birthPrecision: ChildBirthPrecision;
};

export type ChildBirthRecord = {
  birthDate: Date | string | null;
  birthPrecision: ChildBirthPrecision | null;
};

export class ChildBirthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChildBirthValidationError";
  }
}

function utcCalendarParts(value: Date): { year: number; month: number; day: number } {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function parseCalendarDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ChildBirthValidationError("Укажите полную дату рождения");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const parts = utcCalendarParts(probe);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    throw new ChildBirthValidationError("Некорректная дата рождения");
  }
  return { year, month, day };
}

function targetParts(targetDate: Date) {
  if (Number.isNaN(targetDate.getTime())) {
    throw new ChildBirthValidationError("Некорректная целевая дата");
  }
  return utcCalendarParts(targetDate);
}

function exactAgeYears(
  birth: { year: number; month: number; day: number },
  target: { year: number; month: number; day: number },
): number {
  let age = target.year - birth.year;
  if (target.month < birth.month || (target.month === birth.month && target.day < birth.day)) age -= 1;
  return age;
}

function monthAgeYears(
  birth: { year: number; month: number },
  target: { year: number; month: number },
): number {
  return target.year - birth.year - (target.month < birth.month ? 1 : 0);
}

export function fromExactBirthDate(date: string, targetDate = new Date()): StoredChildBirth {
  const parts = parseCalendarDate(date);
  const stored = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  validateChildBirth({ precision: "DAY", date }, targetDate);
  return { birthDate: stored, birthPrecision: "DAY" };
}

export function fromBirthMonthYear(
  year: number,
  month: number,
  targetDate = new Date(),
): StoredChildBirth {
  validateChildBirth({ precision: "MONTH", year, month }, targetDate);
  return {
    birthDate: new Date(Date.UTC(year, month - 1, 1)),
    birthPrecision: "MONTH",
  };
}

export function normalizeChildBirthInput(
  input: ChildBirthInput,
  targetDate = new Date(),
): StoredChildBirth {
  return input.precision === "DAY"
    ? fromExactBirthDate(input.date, targetDate)
    : fromBirthMonthYear(input.year, input.month, targetDate);
}

export function validateChildBirth(input: ChildBirthInput, targetDate = new Date()): void {
  const target = targetParts(targetDate);
  let age: number;
  if (input.precision === "DAY") {
    const birth = parseCalendarDate(input.date);
    const birthMs = Date.UTC(birth.year, birth.month - 1, birth.day);
    const targetMs = Date.UTC(target.year, target.month - 1, target.day);
    if (birthMs > targetMs) throw new ChildBirthValidationError("Дата рождения не может быть в будущем");
    age = exactAgeYears(birth, target);
  } else {
    if (!Number.isInteger(input.year) || !Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
      throw new ChildBirthValidationError("Некорректный месяц или год рождения");
    }
    if (input.year > target.year || (input.year === target.year && input.month > target.month)) {
      throw new ChildBirthValidationError("Месяц рождения не может быть в будущем");
    }
    age = monthAgeYears(input, target);
  }
  if (age < 0) throw new ChildBirthValidationError("Дата рождения не может быть в будущем");
  if (age >= 18) throw new ChildBirthValidationError("Профиль ребёнка доступен только до 18 лет");
}

function recordParts(record: ChildBirthRecord) {
  if (!record.birthDate) return null;
  const date = record.birthDate instanceof Date ? record.birthDate : new Date(record.birthDate);
  if (Number.isNaN(date.getTime())) return null;
  return utcCalendarParts(date);
}

export function ageYearsAt(record: ChildBirthRecord, targetDate: Date): number | null {
  const birth = recordParts(record);
  if (!birth || Number.isNaN(targetDate.getTime())) return null;
  const target = utcCalendarParts(targetDate);
  const birthMs = Date.UTC(birth.year, birth.month - 1, birth.day);
  const targetMs = Date.UTC(target.year, target.month - 1, target.day);
  if (birthMs > targetMs) return null;
  return record.birthPrecision === "DAY"
    ? exactAgeYears(birth, target)
    : monthAgeYears(birth, target);
}

export function ageRangeAt(record: ChildBirthRecord, targetDate: Date): string | null {
  const years = ageYearsAt(record, targetDate);
  if (years == null) return null;
  const months = years * 12 + (() => {
    const birth = recordParts(record)!;
    const target = utcCalendarParts(targetDate);
    if (record.birthPrecision === "DAY") {
      let delta = target.month - birth.month;
      if (target.day < birth.day) delta -= 1;
      return (delta + 12) % 12;
    }
    return (target.month - birth.month + 12) % 12;
  })();
  return AGE_GROUPS.find((g) => months >= g.minMonths && (g.maxMonths == null || months < g.maxMonths))?.value ?? null;
}

export function hasExactBirthday(record: ChildBirthRecord): boolean {
  return Boolean(record.birthDate && record.birthPrecision === "DAY");
}

export function nextBirthday(record: ChildBirthRecord, targetDate = new Date()): Date | null {
  const birth = recordParts(record);
  if (!birth || record.birthPrecision !== "DAY" || Number.isNaN(targetDate.getTime())) return null;
  const target = utcCalendarParts(targetDate);
  let year = target.year;
  let candidate = new Date(Date.UTC(year, birth.month - 1, birth.day));
  if (candidate.getTime() < Date.UTC(target.year, target.month - 1, target.day)) {
    year += 1;
    candidate = new Date(Date.UTC(year, birth.month - 1, birth.day));
  }
  return candidate;
}

export function normalizeChildName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function childDisplayName(name: string | null | undefined, unnamedIndex?: number): string {
  const normalized = normalizeChildName(name);
  if (normalized) return normalized;
  return unnamedIndex == null ? "Ребёнок" : `Ребёнок ${unnamedIndex}`;
}

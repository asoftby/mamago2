import {
  ChildBirthValidationError,
  normalizeChildBirthInput,
  type ChildBirthPrecision,
  type StoredChildBirth,
} from "./birth";

export type ParsedBirthPatch =
  | { touched: false }
  | { touched: true; value: StoredChildBirth | null };

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export function parseChildBirthPayload(
  body: Record<string, unknown>,
  targetDate = new Date(),
): ParsedBirthPatch {
  const touchesBirth = ["birthDate", "birthPrecision", "birthYear", "birthMonth"].some((key) =>
    hasOwn(body, key),
  );
  if (!touchesBirth) return { touched: false };

  const precision = body.birthPrecision as ChildBirthPrecision | null | undefined;
  const birthDate = body.birthDate;
  if (birthDate === null) {
    if (precision != null || hasOwn(body, "birthYear") || hasOwn(body, "birthMonth")) {
      throw new ChildBirthValidationError("Пустая дата не может иметь точность");
    }
    return { touched: true, value: null };
  }

  if (precision === "DAY") {
    if (typeof birthDate !== "string" || hasOwn(body, "birthYear") || hasOwn(body, "birthMonth")) {
      throw new ChildBirthValidationError("Для полной даты передайте только birthDate и DAY");
    }
    return { touched: true, value: normalizeChildBirthInput({ precision, date: birthDate }, targetDate) };
  }

  if (precision === "MONTH") {
    if (hasOwn(body, "birthDate") || typeof body.birthYear !== "number" || typeof body.birthMonth !== "number") {
      throw new ChildBirthValidationError("Для месяца передайте birthYear, birthMonth и MONTH");
    }
    return {
      touched: true,
      value: normalizeChildBirthInput(
        { precision, year: body.birthYear, month: body.birthMonth },
        targetDate,
      ),
    };
  }

  throw new ChildBirthValidationError("Укажите точность даты рождения");
}

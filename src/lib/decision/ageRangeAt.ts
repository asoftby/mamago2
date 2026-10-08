import { ageRangeAt as childAgeRangeAt, type ChildBirthPrecision } from "@/lib/child/birth";

/**
 * Server-side age-range bucket for a child at an arbitrary target date
 * (not "now"). Used to compute decision-context subject snapshots without
 * the client ever sending a birth date.
 */
export function ageRangeAt(
  birthDate: Date,
  targetDate: Date,
  birthPrecision: ChildBirthPrecision | null = null,
): string | null {
  return childAgeRangeAt({ birthDate, birthPrecision }, targetDate);
}

import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

/**
 * Server-side age-range bucket for a child at an arbitrary target date
 * (not "now"). Used to compute decision-context subject snapshots without
 * the client ever sending a birth date.
 */
export function ageRangeAt(birthDate: Date, targetDate: Date): string | null {
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    return null;
  }
  if (targetDate < birthDate) return null;

  let months =
    (targetDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (targetDate.getMonth() - birthDate.getMonth());
  if (targetDate.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) months = 0;

  const group = AGE_GROUPS.find(
    (g) => months >= g.minMonths && (g.maxMonths == null || months < g.maxMonths),
  );
  return group?.value ?? null;
}

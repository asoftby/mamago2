import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/types/activity";

export type AudienceSelection = {
  personas: FamilyPersona[];
  selectedPersonaIds: string[];
};

export type AgeRange = { min: number; max: number };

function overlapsRange(
  activity: Pick<ActivityMock, "ageFrom" | "ageTo">,
  range: AgeRange,
): boolean {
  const actMin = activity.ageFrom ?? 0;
  const actMax = activity.ageTo ?? 99;
  return range.min <= actMax && range.max >= actMin;
}

export function getAgeYearsFromBirthDate(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  let age = now.getFullYear() - date.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hasBirthdayPassed) age -= 1;

  return age >= 0 ? age : null;
}

/**
 * "Я" is an adult self-context, not a synonym for strict ADULT_ONLY.
 *
 * Compatible:
 * - ADULT_ONLY
 * - UNRESTRICTED
 * - specific/legacy ranges that genuinely continue beyond age 18 (18+, 12-99, ...)
 *
 * Not compatible:
 * - UNKNOWN
 * - child/teen ranges ending at 18 (0-18, 5-18, 16-18)
 */
export function matchesAdultSelfAudience(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
): boolean {
  if (activity.agePolicy === "ADULT_ONLY") return true;
  if (activity.agePolicy === "UNRESTRICTED") return true;
  if (activity.agePolicy === "UNKNOWN") return false;

  return (activity.ageTo ?? 99) > 18;
}

/**
 * Child audience eligibility uses exact ages when all selected children have a
 * valid birth date. If at least one selected child has no reliable age, we do
 * not claim that a numeric SPECIFIC range is suitable; only UNRESTRICTED is a
 * safe match.
 */
export function matchesExactChildAges(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  childAges: number[],
  selectedChildCount: number = childAges.length,
): boolean {
  if (activity.agePolicy === "ADULT_ONLY") return false;
  if (activity.agePolicy === "UNRESTRICTED") return true;
  if (activity.agePolicy === "UNKNOWN") return false;
  if (selectedChildCount === 0) return true;
  if (childAges.length !== selectedChildCount) return false;

  const actMin = activity.ageFrom ?? 0;
  const actMax = activity.ageTo ?? 99;
  return childAges.every((age) => age >= actMin && age <= actMax);
}

/** Manual age chips keep OR semantics. 18+ uses adult suitability semantics. */
export function matchesManualAgeRanges(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  ranges: Array<AgeRange & { id?: string }>,
): boolean {
  if (activity.agePolicy === "UNRESTRICTED") return true;
  if (activity.agePolicy === "UNKNOWN") return false;

  return ranges.some((range) =>
    range.id === "18+"
      ? matchesAdultSelfAudience(activity)
      : activity.agePolicy !== "ADULT_ONLY" && overlapsRange(activity, range),
  );
}

/**
 * Canonical persona eligibility used by both city-home ranking and discovery.
 * Children win over an accompanying adult: "Я + ребёнок" means find something
 * suitable for the child, with the adult as companion, not an OR with 18+.
 */
export function matchesSelectedPersonaAudience(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  selection: AudienceSelection,
): boolean {
  if (selection.selectedPersonaIds.length === 0) return true;

  const selected = selection.personas.filter((persona) =>
    selection.selectedPersonaIds.includes(persona.id),
  );
  if (selected.length === 0) return true;

  const children = selected.filter((persona) => persona.kind === "child");
  if (children.length > 0) {
    const ages = children
      .map((child) => getAgeYearsFromBirthDate(child.birthDate))
      .filter((age): age is number => age !== null);
    return matchesExactChildAges(activity, ages, children.length);
  }

  return selected.some((persona) => persona.kind === "adult")
    ? matchesAdultSelfAudience(activity)
    : true;
}

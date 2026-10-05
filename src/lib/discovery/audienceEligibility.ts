import type { ActivityMock } from "@/types/activity";

type AgeRange = { min: number; max: number };

function overlapsRange(
  activity: Pick<ActivityMock, "ageFrom" | "ageTo">,
  range: AgeRange,
): boolean {
  const actMin = activity.ageFrom ?? 0;
  const actMax = activity.ageTo ?? 99;
  return range.min <= actMax && range.max >= actMin;
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
 * Child audience eligibility. Adults accompanying selected children do not add
 * an independent 18+ constraint.
 *
 * Every known selected child age must fit. UNKNOWN and ADULT_ONLY are never
 * eligible for a child context; UNRESTRICTED always is.
 */
export function matchesExactChildAges(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  childAges: number[],
): boolean {
  if (activity.agePolicy === "ADULT_ONLY") return false;
  if (activity.agePolicy === "UNRESTRICTED") return true;
  if (activity.agePolicy === "UNKNOWN") return false;
  if (childAges.length === 0) return true;

  const actMin = activity.ageFrom ?? 0;
  const actMax = activity.ageTo ?? 99;
  return childAges.every((age) => age >= actMin && age <= actMax);
}

/**
 * Discovery currently transports child context as age buckets rather than
 * exact birth ages. Require compatibility with every selected child bucket.
 */
export function matchesChildAgeRanges(
  activity: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  ranges: AgeRange[],
): boolean {
  if (activity.agePolicy === "ADULT_ONLY") return false;
  if (activity.agePolicy === "UNRESTRICTED") return true;
  if (activity.agePolicy === "UNKNOWN") return false;
  if (ranges.length === 0) return true;

  return ranges.every((range) => overlapsRange(activity, range));
}

export function overlapsAnyAgeRange(
  activity: Pick<ActivityMock, "ageFrom" | "ageTo">,
  ranges: AgeRange[],
): boolean {
  return ranges.some((range) => overlapsRange(activity, range));
}

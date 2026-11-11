import { AGE_OPTIONS, sortAgeKeys } from "@/lib/config/ages";

/** All selectable event age buckets for «Любой» (excludes the separate #nokids / ADULT_ONLY chip). */
export function getUnrestrictedEventAgeRangeIds(
  options: ReadonlyArray<{ value: string }> = AGE_OPTIONS,
): string[] {
  return sortAgeKeys(options.map((option) => option.value));
}

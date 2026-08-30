import { AgePolicy } from "@prisma/client";
import { AGE_OPTIONS, isValidAgeKey } from "@/lib/config/ages";

/**
 * Whether a specific age chip should render as visually selected.
 *
 * `ageTags: []` has its own explicit UI chip ("Любой возраст") and must not
 * make every specific age chip look selected. Keeping these states exclusive
 * makes the visual state match the stored AgePolicy semantics.
 */
export function isPlaceAgeChipActive(params: {
  storedAgeTags: readonly string[];
  chipAgeTag: string;
}): boolean {
  return params.storedAgeTags.includes(params.chipAgeTag);
}

/**
 * Canonical completeness check for the Place age state.
 *
 * The policy is discriminated: unrestricted/strict policies must not carry
 * suitability buckets, SPECIFIC must carry only valid buckets, and UNKNOWN is
 * deliberately incomplete until an editor asserts the intended semantics.
 */
export function isPlaceAgeSelectionComplete(params: {
  agePolicy: AgePolicy;
  ageTags: readonly string[];
}): boolean {
  switch (params.agePolicy) {
    case AgePolicy.UNRESTRICTED:
    case AgePolicy.ADULT_ONLY:
      return params.ageTags.length === 0;
    case AgePolicy.SPECIFIC:
      return params.ageTags.length > 0 && params.ageTags.every(isValidAgeKey);
    case AgePolicy.UNKNOWN:
    default:
      return false;
  }
}

/**
 * Canonicalizes a just-toggled age-tag list: if every known age option
 * ended up selected, that's semantically identical to "no restriction",
 * so collapse it back to `[]` rather than persisting a full list —
 * `ageTags: []` stays the one and only representation of "any age",
 * never a redundant "all of them" array.
 */
export function canonicalizeAgeTags(tags: readonly string[]): string[] {
  const uniqueKnown = new Set(tags.filter((tag) => AGE_OPTIONS.some((option) => option.key === tag)));
  if (uniqueKnown.size === AGE_OPTIONS.length && uniqueKnown.size === tags.length) {
    return [];
  }
  return [...tags];
}

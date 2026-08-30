import { AGE_OPTIONS } from "@/lib/config/ages";

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
 * Canonicalizes a just-toggled age-tag list: if every known age option
 * ended up selected, that's semantically identical to "no restriction",
 * so collapse it back to `[]` rather than persisting a full list —
 * `ageTags: []` stays the one and only representation of "any age",
 * never a redundant "all of them" array.
 *
 * The Place Wizard currently renders the global `18+` option through the
 * dedicated ADULT_ONLY chip, so this helper mainly protects legacy callers
 * and imported full selections.
 */
export function canonicalizeAgeTags(tags: readonly string[]): string[] {
  const uniqueKnown = new Set(tags.filter((tag) => AGE_OPTIONS.some((option) => option.key === tag)));
  if (uniqueKnown.size === AGE_OPTIONS.length && uniqueKnown.size === tags.length) {
    return [];
  }
  return [...tags];
}

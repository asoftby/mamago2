import { AGE_OPTIONS } from "@/lib/config/ages";

/**
 * Whether a specific age chip should render as visually selected.
 *
 * Storage is unchanged by this: `ageTags: []` still means "no age
 * restriction" everywhere it's read. This only controls display — when
 * nothing is stored, every specific age chip renders active alongside
 * "Любой возраст", making the "suits every age" meaning visually obvious
 * instead of looking like nothing was picked.
 */
export function isPlaceAgeChipActive(params: {
  storedAgeTags: readonly string[];
  chipAgeTag: string;
}): boolean {
  return params.storedAgeTags.length === 0 || params.storedAgeTags.includes(params.chipAgeTag);
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

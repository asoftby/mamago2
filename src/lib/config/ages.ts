/**
 * Unified Age Configuration for mamaGo
 * 
 * Single source of truth for all age-related data across the application.
 * Used in: forms, filters, cards, validation, API, moderation, etc.
 * 
 * CANONICAL SOURCE: Matches AGE_GROUPS from src/features/filters/age/ageGroups.ts
 * This is the format used in discovery filters on the main page.
 * 
 * IMPORTANT: These keys are stored in the database (Place.ageTags, Activity.ageTags, etc.)
 * Do not change existing keys without migration!
 */

export interface AgeOption {
  /** Optional stable id (builder selection, analytics, SignalOption cuid) */
  id?: string;
  /** Unique key stored in database */
  key: string;
  /** Same as `key`; aligned with signals / admin `value` */
  value: string;
  /** Full label for forms and detailed views */
  label: string;
  /** Short label for chips and compact displays */
  shortLabel: string;
  /** Display order (lower = first) */
  order: number;
  /** Whether option is selectable in UI (default true) */
  active: boolean;
  /** Minimum age in years (ranking / personalization) */
  minAge: number;
  /** Maximum age in years inclusive; for open-ended groups use a practical upper bound (e.g. 120) */
  maxAge: number;
  /** Weight multiplier for ranking scores (default 1) */
  weight: number;
  /** Minimum age in years (legacy alias; keep in sync with minAge) */
  min: number;
  /** Maximum age in years (null = no upper limit in legacy model) */
  max: number | null;
  /** Minimum age in months (for filtering) */
  minMonths: number;
  /** Maximum age in months (null = no upper limit) */
  maxMonths: number | null;
}

/**
 * Master list of age options
 * 
 * Format: "0-1", "1-3", "3-5", "5-7", "7-9", "9-12", "12-14", "14-16", "16-18", "18+"
 * This matches the canonical AGE_GROUPS used in discovery filters.
 */
function ageRow(
  key: string,
  label: string,
  shortLabel: string,
  order: number,
  minY: number,
  maxY: number | null,
  minMonths: number,
  maxMonths: number | null,
  openEnded = false,
  optionId?: string
): AgeOption {
  const maxAgeYears = maxY ?? 120;
  return {
    ...(optionId ? { id: optionId } : {}),
    key,
    value: key,
    label,
    shortLabel,
    order,
    active: true,
    minAge: minY,
    maxAge: maxAgeYears,
    weight: 1,
    min: minY,
    max: openEnded ? null : maxY,
    minMonths,
    maxMonths,
  };
}

export const AGE_OPTIONS: readonly AgeOption[] = [
  ageRow("0-1", "0–1 год", "0–1", 1, 0, 1, 0, 12),
  ageRow("1-3", "1–3 года", "1–3", 2, 1, 3, 12, 36),
  ageRow("3-5", "3–5 лет", "3–5", 3, 3, 5, 36, 60),
  ageRow("5-7", "5–7 лет", "5–7", 4, 5, 7, 60, 84),
  ageRow("7-9", "7–9 лет", "7–9", 5, 7, 9, 84, 108),
  ageRow("9-12", "9–12 лет", "9–12", 6, 9, 12, 108, 144),
  ageRow("12-14", "12–14 лет", "12–14", 7, 12, 14, 144, 168),
  ageRow("14-16", "14–16 лет", "14–16", 8, 14, 16, 168, 192),
  ageRow("16-18", "16–18 лет", "16–18", 9, 16, 18, 192, 216),
  ageRow("18+", "#nokids", "#nokids", 10, 18, null, 216, null, true),
] as const;

/**
 * Valid age keys for validation
 */
export const AGE_KEYS = AGE_OPTIONS.map((opt) => opt.key);

/**
 * Age keys as TypeScript union type
 */
export type AgeKey = typeof AGE_KEYS[number];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get age option by key
 */
export function getAgeOption(key: string): AgeOption | undefined {
  return AGE_OPTIONS.find((opt) => opt.key === key);
}

/**
 * Resolve canonical age options from DB/content age tag keys (Place.ageTags, Activity.ageTags, …)
 */
export function resolveAgeOptionsFromKeys(keys: string[]): AgeOption[] {
  if (!keys?.length) return [];
  return keys
    .map((k) => getAgeOption(k))
    .filter((o): o is AgeOption => o !== undefined);
}

/**
 * Get full label for age key
 * @example getAgeLabel("0-1") => "0–1 год"
 * @example getAgeLabel("3-5") => "3–5 лет"
 */
export function getAgeLabel(key: string): string {
  const option = getAgeOption(key);
  return option?.label ?? key;
}

/**
 * Get short label for age key
 * @example getAgeShortLabel("0-1") => "0–1"
 * @example getAgeShortLabel("3-5") => "3–5"
 */
export function getAgeShortLabel(key: string): string {
  const option = getAgeOption(key);
  return option?.shortLabel ?? key;
}

/**
 * Sort age keys by their defined order
 * @example sortAgeKeys(["18+", "0-1", "7-9"]) => ["0-1", "7-9", "18+"]
 */
export function sortAgeKeys(keys: string[]): string[] {
  return keys.slice().sort((a, b) => {
    const optA = getAgeOption(a);
    const optB = getAgeOption(b);
    if (!optA) return 1;
    if (!optB) return -1;
    return optA.order - optB.order;
  });
}

/**
 * Get labels for multiple age keys
 * @example getAgeLabels(["0-1", "3-5"]) => ["0–1 год", "3–5 лет"]
 */
export function getAgeLabels(keys: string[]): string[] {
  return keys.map(getAgeLabel);
}

/**
 * Get short labels for multiple age keys
 * @example getAgeShortLabels(["0-1", "3-5"]) => ["0–1", "3–5"]
 */
export function getAgeShortLabels(keys: string[]): string[] {
  return keys.map(getAgeShortLabel);
}

/**
 * Check if a key is a valid age key
 */
export function isValidAgeKey(key: string): key is AgeKey {
  return AGE_KEYS.includes(key as AgeKey);
}

/**
 * Format age keys as comma-separated labels
 * @example formatAgeKeys(["0-1", "3-5"]) => "0–1 год, 3–5 лет"
 */
export function formatAgeKeys(keys: string[]): string {
  if (keys.length === 0) return "";
  return getAgeLabels(sortAgeKeys(keys)).join(", ");
}

/**
 * Format age keys as comma-separated short labels
 * @example formatAgeKeysShort(["0-1", "3-5"]) => "0–1, 3–5"
 */
export function formatAgeKeysShort(keys: string[]): string {
  if (keys.length === 0) return "";
  return getAgeShortLabels(sortAgeKeys(keys)).join(", ");
}

/**
 * Get age range in months for a single key
 */
export function getAgeRangeMonths(key: string): { minMonths: number; maxMonths: number | null } | null {
  const option = getAgeOption(key);
  if (!option) return null;
  return {
    minMonths: option.minMonths,
    maxMonths: option.maxMonths,
  };
}

/**
 * Get combined age range for multiple keys
 * Returns the MIN of minMonths and MAX of maxMonths
 */
export function getCombinedAgeRange(keys: string[]): {
  minMonths: number;
  maxMonths: number | null;
} | null {
  if (keys.length === 0) return null;

  const ranges = keys
    .map(getAgeRangeMonths)
    .filter((range): range is NonNullable<typeof range> => range !== null);

  if (ranges.length === 0) return null;

  const minMonths = Math.min(...ranges.map((r) => r.minMonths));
  const hasOpenEnd = ranges.some((r) => r.maxMonths === null);
  const maxMonths = hasOpenEnd
    ? null
    : Math.max(...ranges.map((r) => r.maxMonths as number));

  return { minMonths, maxMonths };
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Normalize legacy age keys to current format
 * Handles old formats that might exist in database or URL params
 * 
 * @example normalizeLegacyAgeKey("0_3") => "0-3"
 * @example normalizeLegacyAgeKey("0–3") => "0-3"
 */
export function normalizeLegacyAgeKey(key: string): string {
  // Replace underscores with hyphens
  let normalized = key.replace(/_/g, "-");
  
  // Replace en-dash (–) with hyphen (-)
  normalized = normalized.replace(/–/g, "-");
  
  // Trim whitespace
  normalized = normalized.trim();
  
  return normalized;
}

/**
 * Normalize array of legacy age keys
 */
export function normalizeLegacyAgeKeys(keys: string[]): string[] {
  return keys.map(normalizeLegacyAgeKey).filter(isValidAgeKey);
}

// ============================================================================
// FILTERING & OVERLAP DETECTION
// ============================================================================

/**
 * Check if an item's age range overlaps with selected age range
 * Used for filtering places/activities by age
 * 
 * @param itemMinMonths - Item's minimum age in months
 * @param itemMaxMonths - Item's maximum age in months (null = no limit)
 * @param selectedMinMonths - Selected filter minimum age in months
 * @param selectedMaxMonths - Selected filter maximum age in months (null = no limit)
 */
export function ageRangeOverlaps(
  itemMinMonths: number | null,
  itemMaxMonths: number | null,
  selectedMinMonths: number,
  selectedMaxMonths: number | null
): boolean {
  if (itemMinMonths === null || itemMaxMonths === null) {
    return false;
  }
  
  // Overlap rule: selectedMin <= item.max AND (selectedMax >= item.min OR selectedMax is null)
  const maxOverlaps = selectedMaxMonths === null || selectedMaxMonths >= itemMinMonths;
  return selectedMinMonths <= itemMaxMonths && maxOverlaps;
}

/**
 * Get age options that overlap with a given months range
 * Used for filtering
 */
export function getOverlappingAgeOptions(
  minMonths: number | null,
  maxMonths: number | null
): AgeOption[] {
  if (minMonths === null && maxMonths === null) {
    return [...AGE_OPTIONS];
  }

  return AGE_OPTIONS.filter((option) => {
    const itemMin = minMonths ?? 0;
    const itemMax = maxMonths ?? Infinity;
    const optionMax = option.maxMonths ?? Infinity;

    // Ranges overlap if: itemMin <= optionMax AND itemMax >= option.minMonths
    return itemMin <= optionMax && itemMax >= option.minMonths;
  });
}

/**
 * Find age option by months range
 * Returns exact match if found
 */
export function getAgeOptionByMonths(
  minMonths: number,
  maxMonths: number | null
): AgeOption | undefined {
  return AGE_OPTIONS.find(
    (option) => option.minMonths === minMonths && option.maxMonths === maxMonths
  );
}

/**
 * Convert multiple age keys to a combined range with label
 * Returns the MIN of minMonths and MAX of maxMonths
 * 
 * @example convertAgeKeysToRange(["3-5", "5-7"]) => { minMonths: 36, maxMonths: 84, label: "3–5 лет, 5–7 лет" }
 */
export function convertAgeKeysToRange(keys: string[]): {
  minMonths: number;
  maxMonths: number | null;
  label: string;
} | null {
  if (keys.length === 0) return null;

  const options = keys
    .map((key) => getAgeOption(key))
    .filter((option): option is AgeOption => option !== undefined);

  if (options.length === 0) return null;

  const minMonths = Math.min(...options.map((opt) => opt.minMonths));
  
  // If any option has maxMonths = null, the combined max is null
  const hasOpenEnd = options.some((opt) => opt.maxMonths === null);
  const maxMonths = hasOpenEnd
    ? null
    : Math.max(...options.map((opt) => opt.maxMonths as number));

  // Generate label as comma-separated
  const label = options.map((opt) => opt.label).join(", ");

  return { minMonths, maxMonths, label };
}

/**
 * Legacy age-tag values found in production `Activity.ageTags` that predate
 * the current canonical {@link AGE_OPTIONS} keys. Read-layer only — never
 * mutates stored data.
 *
 * `"18"` — a non-canonical Event Wizard chip value soft-deactivated by
 * `scripts/data-migrations/20260804-upsert-canonical-age-signal-options.ts`
 * ("Local may have used value "18" instead of canonical "18+""). That
 * migration only deactivated the selectable `SignalOption` row and explicitly
 * left existing `Activity.ageTags` content untouched, so events created
 * against the old chip (e.g. `interaktivnyy-kvest-mir-naoschup`, live DB
 * audit 2026-08-24: 1 row) still carry the literal `"18"`.
 */
const LEGACY_AGE_KEY_ALIASES: Record<string, string> = {
  "18": "18+",
};

function normalizeAgeTagKey(key: string): string {
  return LEGACY_AGE_KEY_ALIASES[key] ?? key;
}

/**
 * Compact age-range label from selected ageTags (canonical shared formatter —
 * used by both Stories and the public event page; do not reimplement).
 *
 * Collapses a *contiguous* run of adjacent categories into one range. A
 * non-contiguous selection is never collapsed to min–max (that would imply
 * coverage of the gap, which is false) — it falls back to the existing
 * comma-separated {@link formatAgeKeys} enumeration instead. Known legacy
 * key aliases (see {@link LEGACY_AGE_KEY_ALIASES}) are normalized first;
 * any other unrecognized key is simply dropped, same as before.
 *
 * @example formatAgeTagsCompact(["5-7","7-9","9-12","12-14","14-16","16-18","18+"]) => "5+"
 * @example formatAgeTagsCompact(["5-7","7-9","9-12","12-14"]) => "5–14 лет"
 * @example formatAgeTagsCompact(["5-7"]) => "5–7 лет"
 * @example formatAgeTagsCompact(["3-5","9-12"]) => "3–5 лет, 9–12 лет" (gap preserved, not "3–12 лет")
 * @example formatAgeTagsCompact(["0-1", …, "18+"]) => "Любой возраст" (full coverage — existing universal-age semantics)
 * @example formatAgeTagsCompact(["14-16","16-18","18"]) => "14+" (legacy "18" alias normalized to "18+")
 */
export function formatAgeTagsCompact(keys: string[] | null | undefined): string | undefined {
  const validKeys = [...new Set((keys ?? []).map(normalizeAgeTagKey))].filter(isValidAgeKey);
  if (validKeys.length === 0) return undefined;

  const indices = validKeys
    .map((key) => AGE_OPTIONS.findIndex((opt) => opt.key === key))
    .sort((a, b) => a - b);

  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1]! + 1);
  if (!isContiguous) return formatAgeKeys(validKeys);

  const first = AGE_OPTIONS[indices[0]!]!;
  const last = AGE_OPTIONS[indices[indices.length - 1]!]!;

  if (first.key === "0-1" && last.key === "18+") return "Любой возраст";
  if (last.key === "18+") return `${first.minAge}+`;
  if (first === last) return first.label;
  return `${first.minAge}–${last.maxAge} лет`;
}

/**
 * Format age range for display
 *
 * @example formatAgeRange(0, 12) => "0–1 год"
 * @example formatAgeRange(36, 60) => "3–5 лет"
 * @example formatAgeRange(216, null) => "18+"
 */
export function formatAgeRange(
  minMonths: number | null,
  maxMonths: number | null
): string {
  if (minMonths === null && maxMonths === null) {
    return "Любой возраст";
  }

  // Find exact matching option
  if (minMonths !== null) {
    const matchingOption = getAgeOptionByMonths(minMonths, maxMonths);
    if (matchingOption) {
      return matchingOption.label;
    }
  }

  // Custom range - format manually
  const minYears = minMonths ? Math.floor(minMonths / 12) : 0;
  const maxYears = maxMonths ? Math.floor(maxMonths / 12) : null;

  if (maxYears === null) {
    return `${minYears}+`;
  }

  return `${minYears}–${maxYears} лет`;
}

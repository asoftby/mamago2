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
  /** Unique key stored in database */
  key: string;
  /** Full label for forms and detailed views */
  label: string;
  /** Short label for chips and compact displays */
  shortLabel: string;
  /** Display order (lower = first) */
  order: number;
  /** Minimum age in years */
  min: number;
  /** Maximum age in years (null = no upper limit) */
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
export const AGE_OPTIONS: readonly AgeOption[] = [
  {
    key: "0-1",
    label: "0–1 год",
    shortLabel: "0–1",
    order: 1,
    min: 0,
    max: 1,
    minMonths: 0,
    maxMonths: 12,
  },
  {
    key: "1-3",
    label: "1–3 года",
    shortLabel: "1–3",
    order: 2,
    min: 1,
    max: 3,
    minMonths: 12,
    maxMonths: 36,
  },
  {
    key: "3-5",
    label: "3–5 лет",
    shortLabel: "3–5",
    order: 3,
    min: 3,
    max: 5,
    minMonths: 36,
    maxMonths: 60,
  },
  {
    key: "5-7",
    label: "5–7 лет",
    shortLabel: "5–7",
    order: 4,
    min: 5,
    max: 7,
    minMonths: 60,
    maxMonths: 84,
  },
  {
    key: "7-9",
    label: "7–9 лет",
    shortLabel: "7–9",
    order: 5,
    min: 7,
    max: 9,
    minMonths: 84,
    maxMonths: 108,
  },
  {
    key: "9-12",
    label: "9–12 лет",
    shortLabel: "9–12",
    order: 6,
    min: 9,
    max: 12,
    minMonths: 108,
    maxMonths: 144,
  },
  {
    key: "12-14",
    label: "12–14 лет",
    shortLabel: "12–14",
    order: 7,
    min: 12,
    max: 14,
    minMonths: 144,
    maxMonths: 168,
  },
  {
    key: "14-16",
    label: "14–16 лет",
    shortLabel: "14–16",
    order: 8,
    min: 14,
    max: 16,
    minMonths: 168,
    maxMonths: 192,
  },
  {
    key: "16-18",
    label: "16–18 лет",
    shortLabel: "16–18",
    order: 9,
    min: 16,
    max: 18,
    minMonths: 192,
    maxMonths: 216,
  },
  {
    key: "18+",
    label: "18+",
    shortLabel: "18+",
    order: 10,
    min: 18,
    max: null,
    minMonths: 216,
    maxMonths: null,
  },
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

/**
 * Unified Age Range System for mamaGo
 * 
 * Age ranges are stored in the database using MONTHS (ageMinMonths, ageMaxMonths).
 * This ensures precise filtering and future child-age matching.
 */

export interface AgeRange {
  id: string;
  label: string;
  minMonths: number;
  maxMonths: number | null; // null means "and above"
}

export const AGE_RANGES: AgeRange[] = [
  { id: "0-1", label: "0–1 год", minMonths: 0, maxMonths: 12 },
  { id: "1-3", label: "1–3 года", minMonths: 12, maxMonths: 36 },
  { id: "3-5", label: "3–5 лет", minMonths: 36, maxMonths: 60 },
  { id: "5-7", label: "5–7 лет", minMonths: 60, maxMonths: 84 },
  { id: "7-9", label: "7–9 лет", minMonths: 84, maxMonths: 108 },
  { id: "9-12", label: "9–12 лет", minMonths: 108, maxMonths: 144 },
  { id: "12-14", label: "12–14 лет", minMonths: 144, maxMonths: 168 },
  { id: "14-16", label: "14–16 лет", minMonths: 168, maxMonths: 192 },
  { id: "16-18", label: "16–18 лет", minMonths: 192, maxMonths: 216 },
  { id: "18+", label: "#nokids", minMonths: 216, maxMonths: null },
];

/**
 * Get age range by ID
 */
export function getAgeRangeById(id: string): AgeRange | undefined {
  return AGE_RANGES.find((range) => range.id === id);
}

/**
 * Convert age ID to months range
 * Returns { minMonths, maxMonths }
 */
export function convertAgeIdToMonths(id: string): {
  minMonths: number;
  maxMonths: number | null;
} | null {
  const range = getAgeRangeById(id);
  if (!range) return null;
  return {
    minMonths: range.minMonths,
    maxMonths: range.maxMonths,
  };
}

/**
 * Convert multiple age IDs to a combined range
 * Returns the MIN of minMonths and MAX of maxMonths
 */
export function convertAgeIdsToRange(ids: string[]): {
  minMonths: number;
  maxMonths: number | null;
  label: string;
} | null {
  if (ids.length === 0) return null;

  const ranges = ids
    .map((id) => getAgeRangeById(id))
    .filter((range): range is AgeRange => range !== undefined);

  if (ranges.length === 0) return null;

  const minMonths = Math.min(...ranges.map((r) => r.minMonths));
  
  // If any range has maxMonths = null, the combined max is null
  const hasOpenEnd = ranges.some((r) => r.maxMonths === null);
  const maxMonths = hasOpenEnd
    ? null
    : Math.max(...ranges.map((r) => r.maxMonths as number));

  // Generate label as comma-separated
  const label = ranges.map((r) => r.label).join(", ");

  return { minMonths, maxMonths, label };
}

/**
 * Get age ranges that overlap with a given months range
 * Used for filtering activities by age
 */
export function getOverlappingAgeRanges(
  minMonths: number | null,
  maxMonths: number | null
): AgeRange[] {
  if (minMonths === null && maxMonths === null) {
    return AGE_RANGES;
  }

  return AGE_RANGES.filter((range) => {
    // Activity has no age restriction
    if (minMonths === null && maxMonths === null) return true;

    // Check for overlap
    // Activity range: [minMonths, maxMonths]
    // Filter range: [range.minMonths, range.maxMonths]
    
    const activityMin = minMonths ?? 0;
    const activityMax = maxMonths ?? Infinity;
    const rangeMax = range.maxMonths ?? Infinity;

    // Ranges overlap if:
    // activityMin <= rangeMax AND activityMax >= range.minMonths
    return activityMin <= rangeMax && activityMax >= range.minMonths;
  });
}

/**
 * Format age range for display
 */
export function formatAgeRange(
  minMonths: number | null,
  maxMonths: number | null
): string {
  if (minMonths === null && maxMonths === null) {
    return "Любой возраст";
  }

  // Find matching ranges
  const matchingRanges = AGE_RANGES.filter((range) => {
    if (minMonths === null || maxMonths === null) return false;
    return range.minMonths === minMonths && range.maxMonths === maxMonths;
  });

  if (matchingRanges.length === 1) {
    return matchingRanges[0].label;
  }

  // Custom range - format manually
  const minYears = minMonths ? Math.floor(minMonths / 12) : 0;
  const maxYears = maxMonths ? Math.floor(maxMonths / 12) : null;

  if (maxYears === null) {
    return `${minYears}+`;
  }

  return `${minYears}–${maxYears} лет`;
}

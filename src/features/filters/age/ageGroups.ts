/**
 * Age Groups Configuration
 * Single source of truth for age ranges used across:
 * - Discovery filters
 * - Content creation forms (Events, Places, Offers)
 * - Filtering logic
 */

export interface AgeGroup {
  label: string;           // Display label (Russian)
  value: string;           // Unique identifier
  min: number;             // Minimum age in years
  max: number | null;      // Maximum age in years (null for open-ended)
  minMonths: number;       // Minimum age in months (for DB storage)
  maxMonths: number | null; // Maximum age in months (for DB storage, null for 18+)
}

export const AGE_GROUPS: AgeGroup[] = [
  {
    label: "0–1 год",
    value: "0-1",
    min: 0,
    max: 1,
    minMonths: 0,
    maxMonths: 12,
  },
  {
    label: "1–3 года",
    value: "1-3",
    min: 1,
    max: 3,
    minMonths: 12,
    maxMonths: 36,
  },
  {
    label: "3–5 лет",
    value: "3-5",
    min: 3,
    max: 5,
    minMonths: 36,
    maxMonths: 60,
  },
  {
    label: "5–7 лет",
    value: "5-7",
    min: 5,
    max: 7,
    minMonths: 60,
    maxMonths: 84,
  },
  {
    label: "7–9 лет",
    value: "7-9",
    min: 7,
    max: 9,
    minMonths: 84,
    maxMonths: 108,
  },
  {
    label: "9–12 лет",
    value: "9-12",
    min: 9,
    max: 12,
    minMonths: 108,
    maxMonths: 144,
  },
  {
    label: "12–14 лет",
    value: "12-14",
    min: 12,
    max: 14,
    minMonths: 144,
    maxMonths: 168,
  },
  {
    label: "14–16 лет",
    value: "14-16",
    min: 14,
    max: 16,
    minMonths: 168,
    maxMonths: 192,
  },
  {
    label: "16–18 лет",
    value: "16-18",
    min: 16,
    max: 18,
    minMonths: 192,
    maxMonths: 216,
  },
  {
    label: "18+",
    value: "18+",
    min: 18,
    max: null,
    minMonths: 216,
    maxMonths: null, // Open-ended
  },
];

/**
 * Find age group by value
 */
export function getAgeGroupByValue(value: string): AgeGroup | undefined {
  return AGE_GROUPS.find((group) => group.value === value);
}

/**
 * Find age group that contains the given age range (in months)
 */
export function getAgeGroupByMonths(
  minMonths: number,
  maxMonths: number
): AgeGroup | undefined {
  return AGE_GROUPS.find(
    (group) => group.minMonths === minMonths && group.maxMonths === maxMonths
  );
}

/**
 * Check if an item's age range overlaps with selected age range
 * Used for filtering
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
 * Convert multiple age group values to a combined range
 * Returns the MIN of minMonths and MAX of maxMonths
 */
export function convertAgeGroupsToRange(values: string[]): {
  minMonths: number;
  maxMonths: number | null;
  label: string;
} | null {
  if (values.length === 0) return null;

  const groups = values
    .map((value) => getAgeGroupByValue(value))
    .filter((group): group is AgeGroup => group !== undefined);

  if (groups.length === 0) return null;

  const minMonths = Math.min(...groups.map((g) => g.minMonths));
  
  // If any group has maxMonths = null, the combined max is null
  const hasOpenEnd = groups.some((g) => g.maxMonths === null);
  const maxMonths = hasOpenEnd
    ? null
    : Math.max(...groups.map((g) => g.maxMonths as number));

  // Generate label as comma-separated
  const label = groups.map((g) => g.label).join(", ");

  return { minMonths, maxMonths, label };
}

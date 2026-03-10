/**
 * Place Chips Utilities
 * Formats place metadata (age, category, format) into compact chips for cards
 */

/**
 * Category labels mapping
 * Maps database category keys to human-readable labels
 */
const CATEGORY_LABELS: Record<string, string> = {
  cafe: "Кафе",
  restaurant: "Ресторан",
  museum: "Музей",
  park: "Парк",
  playground: "Площадка",
  theater: "Театр",
  cinema: "Кино",
  library: "Библиотека",
  sports: "Спорт",
  education: "Образование",
  entertainment: "Развлечения",
  shopping: "Магазин",
  service: "Услуга",
  other: "Другое",
};

/**
 * Visit format labels mapping
 * Maps database format keys to human-readable labels
 */
const FORMAT_LABELS: Record<string, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  online: "Online",
  hybrid: "Гибрид",
};

/**
 * Get human-readable label for category
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Get human-readable label for visit format
 */
export function getFormatLabel(format: string): string {
  return FORMAT_LABELS[format] || format;
}

/**
 * Get minimum age from age tags and format as "N+"
 * @param ageTags - Array of age tags (e.g., ["1-3", "3-5"])
 * @returns Formatted age string (e.g., "1+") or null if no valid age
 */
function getMinimumAgeLabel(ageTags: string[]): string | null {
  if (ageTags.length === 0) return null;

  // Extract minimum age from all tags
  const minAges = ageTags
    .map((tag) => {
      // Parse "N-M" or "N+" format
      const match = tag.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((age): age is number => age !== null);

  if (minAges.length === 0) return null;

  const minAge = Math.min(...minAges);
  return `${minAge}+`;
}

/**
 * Build chips for place card display
 * Priority: age > category > format
 * Max 3 chips
 * 
 * @param ageTags - Array of age tags (e.g., ["0-1", "1-3"])
 * @param category - Category key (e.g., "cafe")
 * @param visitFormats - Array of format keys (e.g., ["indoor", "outdoor"])
 * @returns Array of chip labels (max 3)
 */
export function buildPlaceChips(
  ageTags: string[] | null | undefined,
  category: string | null | undefined,
  visitFormats: string[] | null | undefined
): string[] {
  const chips: string[] = [];

  // Priority 1: Age as "N+" format
  if (ageTags && ageTags.length > 0) {
    const ageLabel = getMinimumAgeLabel(ageTags);
    if (ageLabel) {
      chips.push(ageLabel);
    }
  }

  // Priority 2: Category
  if (category && chips.length < 3) {
    const categoryLabel = getCategoryLabel(category);
    chips.push(categoryLabel);
  }

  // Priority 3: First visit format
  if (visitFormats && visitFormats.length > 0 && chips.length < 3) {
    const formatLabel = getFormatLabel(visitFormats[0]);
    chips.push(formatLabel);
  }

  return chips;
}

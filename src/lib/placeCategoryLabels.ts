/**
 * Place Category Labels
 * Maps category values to human-readable labels
 */

export const PLACE_CATEGORY_LABELS: Record<string, string> = {
  "cafe": "Кафе и рестораны",
  "museum": "Музеи",
  "park": "Парки и площадки",
  "kids-center": "Детские центры",
  "theater": "Театры",
  "sport": "Спортивные объекты",
  "entertainment": "Развлечения",
  "education": "Образование",
  "other": "Другое",
};

/**
 * Get human-readable label for a category
 * @param category - Category value (e.g., "kids-center")
 * @returns Human-readable label (e.g., "Детские центры")
 */
export function getCategoryLabel(category: string | null): string | null {
  if (!category) return null;
  return PLACE_CATEGORY_LABELS[category] || category;
}

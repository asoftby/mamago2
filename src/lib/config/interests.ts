/**
 * System interests configuration for children
 * Used for matching with activities, events, and recommendations
 */

export interface SystemInterest {
  slug: string;
  label: string;
  description?: string;
}

export const SYSTEM_INTERESTS: SystemInterest[] = [
  { slug: "sport", label: "Спорт" },
  { slug: "music", label: "Музыка" },
  { slug: "art", label: "Рисование" },
  { slug: "dance", label: "Танцы" },
  { slug: "animals", label: "Животные" },
  { slug: "books", label: "Книги" },
  { slug: "construction", label: "Конструкторы" },
  { slug: "science", label: "Наука" },
  { slug: "nature", label: "Природа" },
  { slug: "technology", label: "Техника" },
  { slug: "creativity", label: "Творчество" },
  { slug: "active-games", label: "Активные игры" },
  { slug: "quiet-activities", label: "Спокойные занятия" },
];

/**
 * Get system interest by slug
 */
export function getSystemInterest(slug: string): SystemInterest | undefined {
  return SYSTEM_INTERESTS.find(interest => interest.slug === slug);
}

/**
 * Get system interest label by slug
 */
export function getSystemInterestLabel(slug: string): string {
  const interest = getSystemInterest(slug);
  return interest?.label || slug;
}
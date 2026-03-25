/**
 * Единая транслитерация и нормализация slug для таксономий / справочников (админка).
 *
 * Ранее здесь была отдельная реализация маппинга.
 * Теперь она делегирует единым правилам из `src/lib/slugifyLabelToValue.ts`,
 * чтобы VALUE из LABEL был консистентным во всех справочниках.
 */

import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";

/**
 * Нормализация slug: транслитерация (если нужно) + kebab-case.
 */
export function normalizeTaxonomySlug(raw: string): string {
  return slugifyLabelToValue(raw);
}

/**
 * Транслитерация названия в slug (кириллица -> латиница, затем slugify).
 */
export function transliterateToSlug(source: string): string {
  return slugifyLabelToValue(source);
}

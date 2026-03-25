import {
  normalizeTaxonomySlug,
  transliterateToSlug,
} from "@/lib/taxonomy/transliterateToSlug";

/** @deprecated используйте normalizeTaxonomySlug — оставлено для обратной совместимости импортов */
export const normalizeEventCategorySlug = normalizeTaxonomySlug;

/**
 * Slug из ввода; если после нормализации пусто (кириллица и т.д.) — транслитерация названия.
 * В крайнем случае — уникальный суффикс, чтобы создание в админке не падало с 400.
 */
export function ensureEventCategorySlug(slugInput: string, nameFallback: string): string {
  const trimmed = slugInput.trim();
  let candidate = normalizeTaxonomySlug(trimmed);
  if (!candidate && trimmed) {
    candidate = transliterateToSlug(trimmed);
  }
  if (!candidate && nameFallback.trim()) {
    candidate = transliterateToSlug(nameFallback.trim());
  }
  if (!candidate) {
    candidate = `cat-${Date.now().toString(36)}`;
  }
  return candidate;
}

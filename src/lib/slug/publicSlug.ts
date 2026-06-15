import { slugifyRu } from "@/lib/slugify";

export class EmptyPublicationSlugError extends Error {
  constructor(message = "Введите заголовок или slug") {
    super(message);
    this.name = "EmptyPublicationSlugError";
  }
}

/** Нормализация без fallback — пустая строка, если после slugify не осталось символов. */
export function normalizeSlugStrict(text: string): string {
  return slugifyRu((text ?? "").trim(), false);
}

/** Транслит + нормализация заголовка в slug (совпадает с server-side `slugifyRu`). */
export function slugifyTitle(title: string, emptyFallback = "item"): string {
  const strict = normalizeSlugStrict(title);
  if (strict) return strict;
  return slugifyRu(title.trim(), emptyFallback);
}

/** Нормализация ручного ввода slug. */
export function normalizeSlug(slug: string, emptyFallback = "item"): string {
  if (!slug.trim()) return "";
  const strict = normalizeSlugStrict(slug);
  if (strict) return strict;
  return slugifyRu(slug.trim(), emptyFallback);
}

export function isMeaningfulPublicationTitle(title: string): boolean {
  const t = title.trim();
  return Boolean(t) && t !== "Без названия";
}

/**
 * Server-side slug candidate перед уникальностью.
 * @throws EmptyPublicationSlugError если нет валидного title/slug и fallback запрещён
 */
export function resolveSlugCandidateForSave(args: {
  title: string;
  slugInput?: string | null;
  entityType: string;
  entityId: string;
  allowIdFallback?: boolean;
}): string {
  const { title, slugInput, entityType, entityId, allowIdFallback = true } = args;

  const fromInput = slugInput?.trim() ? normalizeSlugStrict(slugInput) : "";
  if (fromInput) return fromInput;
  if (slugInput?.trim()) {
    throw new EmptyPublicationSlugError();
  }

  if (isMeaningfulPublicationTitle(title)) {
    const fromTitle = normalizeSlugStrict(title);
    if (fromTitle) return fromTitle;
  }

  if (!allowIdFallback) {
    throw new EmptyPublicationSlugError();
  }

  const shortId = entityId.replace(/\W/g, "").slice(-8) || "draft";
  return `${entityType}-${shortId}`;
}

/**
 * Slug для live-preview: сохранённый ввод → нормализованный slug;
 * иначе — предложение из заголовка, пока slug не трогали вручную.
 */
export function buildSlugPreview(args: {
  title: string;
  slug: string;
  wasSlugTouched: boolean;
  emptyFallback?: string;
}): string {
  const { title, slug, wasSlugTouched, emptyFallback = "item" } = args;
  if (slug.trim()) {
    return normalizeSlug(slug, emptyFallback);
  }
  if (wasSlugTouched || !title.trim()) {
    return "";
  }
  return slugifyTitle(title, emptyFallback);
}

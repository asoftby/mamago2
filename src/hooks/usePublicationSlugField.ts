import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSlugPreview,
  normalizeSlug,
} from "@/lib/slug/publicSlug";

export type UsePublicationSlugFieldOptions = {
  title: string;
  slug: string;
  setSlug: (value: string) => void;
  /** Slug, уже сохранённый в БД (после первого save). */
  persistedSlug: string | null;
  /** После первого сохранения slug больше не предлагается из заголовка. */
  slugLocked?: boolean;
  isPublished: boolean;
  emptyFallback?: string;
  /** Сущность поддерживает slug history (Article и т.п.). */
  slugHistorySupported?: boolean;
};

export function usePublicationSlugField({
  title,
  slug,
  setSlug,
  persistedSlug,
  slugLocked = false,
  isPublished,
  emptyFallback = "item",
  slugHistorySupported = false,
}: UsePublicationSlugFieldOptions) {
  const [wasSlugTouched, setWasSlugTouched] = useState(() => Boolean(persistedSlug?.trim()));

  useEffect(() => {
    if (persistedSlug?.trim() || slugLocked) {
      setWasSlugTouched(true);
    }
  }, [persistedSlug, slugLocked]);

  const previewSlug = useMemo(
    () =>
      buildSlugPreview({
        title: slugLocked ? "" : title,
        slug,
        wasSlugTouched: wasSlugTouched || slugLocked,
        emptyFallback,
      }),
    [title, slug, wasSlugTouched, slugLocked, emptyFallback],
  );

  const isSlugPinned = Boolean(persistedSlug?.trim()) || slugLocked;

  const onSlugChange = useCallback(
    (raw: string) => {
      setWasSlugTouched(true);
      setSlug(raw);
    },
    [setSlug],
  );

  const hydrateSlug = useCallback(
    (nextSlug: string | null | undefined) => {
      const value = nextSlug?.trim() ?? "";
      setSlug(value);
      setWasSlugTouched(Boolean(value));
    },
    [setSlug],
  );

  const normalizedInputSlug = slug.trim() ? normalizeSlug(slug, emptyFallback) : "";
  const normalizedPersistedSlug = persistedSlug?.trim()
    ? normalizeSlug(persistedSlug, emptyFallback)
    : "";

  const showPublishedSlugWarning =
    isPublished &&
    slugHistorySupported &&
    Boolean(normalizedPersistedSlug) &&
    Boolean(normalizedInputSlug) &&
    normalizedInputSlug !== normalizedPersistedSlug;

  const showPublishedSlugWarningGeneric =
    isPublished &&
    !slugHistorySupported &&
    Boolean(normalizedPersistedSlug) &&
    Boolean(normalizedInputSlug) &&
    normalizedInputSlug !== normalizedPersistedSlug;

  return {
    previewSlug,
    onSlugChange,
    hydrateSlug,
    isSlugPinned,
    wasSlugTouched,
    showPublishedSlugWarning,
    showPublishedSlugWarningGeneric,
  };
}

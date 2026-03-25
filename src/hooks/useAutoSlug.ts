import { useCallback, useRef, useState } from "react";
import { transliterateToSlug } from "@/lib/taxonomy/transliterateToSlug";

export type UseAutoSlugOptions = {
  /**
   * `create` — slug генерируется из названия, пока пользователь не правил slug вручную.
   * `edit` — slug не меняется при изменении названия; только при ручном вводе в поле slug.
   */
  mode?: "create" | "edit";
};

/**
 * Автогенерация slug из title/name: транслитерация + kebab-case (`transliterateToSlug`).
 *
 * - **create:** slug следует за источником, пока slug не редактировали вручную.
 * - **edit:** slug стабилен при смене названия (URL/идентификатор не ломаются).
 *
 * После `hydrate` в режиме create снова включается автосинхронизация до следующего ручного ввода в slug.
 */
export function useAutoSlug(
  initialSource: string,
  initialSlug: string,
  options?: UseAutoSlugOptions,
) {
  const isEditMode = options?.mode === "edit";

  const [source, setSourceState] = useState(initialSource);
  const [slug, setSlugState] = useState(initialSlug);
  /**
   * isValueEditedManually:
   * - create: false, пока пользователь не начал править VALUE вручную
   * - edit: true, чтобы название не ломало slug/URL
   *
   * Важное поведение:
   * - если пользователь очистил VALUE (ввёл пусто), автогенерация разрешается снова
   */
  const valueEditedManually = useRef(isEditMode);

  const setSource = useCallback(
    (value: string) => {
      setSourceState(value);
      if (!valueEditedManually.current) {
        setSlugState(transliterateToSlug(value));
      }
    },
    [],
  );

  const setSlug = useCallback((value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      // Preferred UX: если VALUE пустой — снова включаем автогенерацию из LABEL.
      valueEditedManually.current = false;
      setSlugState(transliterateToSlug(source));
      return;
    }

    valueEditedManually.current = true;
    setSlugState(value);
  }, [source]);

  const hydrate = useCallback(
    (nextSource: string, nextSlug: string) => {
      valueEditedManually.current = isEditMode;
      setSourceState(nextSource);
      setSlugState(nextSlug);
    },
    [isEditMode],
  );

  return { source, slug, setSource, setSlug, hydrate, isValueEditedManually: valueEditedManually.current };
}

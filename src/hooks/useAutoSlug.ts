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
   * - create: false, пока пользователь не начал править slug вручную
   * - edit: true, чтобы название не ломало slug/URL
   *
   * Пустой slug в поле ввода сохраняется (не подставляется slug из названия),
   * иначе нельзя стереть slug до конца. На сохранении сервер может заполнить slug из title.
   */
  const valueEditedManually = useRef(isEditMode);
  const [isValueEditedManually, setIsValueEditedManually] = useState(isEditMode);

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
    // Только явная пустая строка или одни пробелы — в пустой slug.
    // Не используем trim() для «есть ли текст»: иначе ломается ввод (например лидирующий пробел при вставке).
    if (value === "" || /^\s*$/.test(value)) {
      valueEditedManually.current = true;
      setIsValueEditedManually(true);
      setSlugState("");
      return;
    }
    valueEditedManually.current = true;
    setIsValueEditedManually(true);
    setSlugState(value);
  }, []);

  const hydrate = useCallback(
    (nextSource: string, nextSlug: string) => {
      valueEditedManually.current = isEditMode;
      setIsValueEditedManually(isEditMode);
      setSourceState(nextSource);
      setSlugState(nextSlug);
    },
    [isEditMode],
  );

  return { source, slug, setSource, setSlug, hydrate, isValueEditedManually };
}

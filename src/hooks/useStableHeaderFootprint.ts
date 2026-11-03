"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Держит место хедера в потоке документа постоянным, пока сворачивается его вторая строка.
 *
 * Почему: хедер `sticky`/`relative` лежит в потоке. Когда строка поиска схлопывается
 * (expanded → compact), хедер становится ниже на её высоту, и весь контент под ним
 * прыгает вверх на ~80px. На коротких страницах вдобавок укорачивается документ:
 * браузер обрезает `scrollY` ниже порога разворота, хедер разворачивается, и всё
 * повторяется по кругу.
 *
 * Как: хедер получает `margin-bottom` = (натуральная высота строки − её текущая высота).
 * Сумма постоянна, поэтому контент и `scrollHeight` не меняются, а сам хедер выглядит
 * как раньше — сворачивается поверх контента, как у Airbnb.
 *
 * Компенсация пишется из `onUpdate` анимации (передать в `motion.div` строки) — в том же
 * кадре и до layout, что и `max-height`. Если писать её позже (например, из ResizeObserver),
 * браузер успевает на промежуточном layout обрезать `scrollY` у низа короткой страницы.
 * ResizeObserver нужен только для натуральной высоты строки и как страховка.
 *
 * @param headerRef корневой `<header>` (ему ставится `margin-bottom`)
 * @param rowRef сворачиваемая строка (`overflow: hidden`, анимируемый `max-height`)
 * @param rowInnerRef содержимое строки (его высота не зависит от `max-height`)
 * @param enabled строка отрендерена
 * @returns обработчик для `onUpdate` у `motion.div` строки
 */
export function useStableHeaderFootprint(
  headerRef: RefObject<HTMLElement | null>,
  rowRef: RefObject<HTMLElement | null>,
  rowInnerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  /** Натуральная высота содержимого строки, px. */
  const naturalRef = useRef<number | null>(null);
  /** Последнее значение `max-height` из анимации, px (`null` — ещё не было). */
  const maxHeightRef = useRef<number | null>(null);

  const apply = useCallback(() => {
    const header = headerRef.current;
    const natural = naturalRef.current;
    if (!header || natural === null) return;

    const visible =
      maxHeightRef.current !== null
        ? Math.min(natural, maxHeightRef.current)
        : (rowRef.current?.getBoundingClientRect().height ?? natural);
    const collapsedBy = natural - visible;
    header.style.marginBottom = collapsedBy > 0.5 ? `${collapsedBy}px` : "";
  }, [headerRef, rowRef]);

  useIsomorphicLayoutEffect(() => {
    const header = headerRef.current;
    const inner = rowInnerRef.current;
    if (!enabled || !header || !inner) {
      if (header) header.style.marginBottom = "";
      naturalRef.current = null;
      maxHeightRef.current = null;
      return;
    }

    const measure = () => {
      naturalRef.current = inner.getBoundingClientRect().height;
      apply();
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        header.style.marginBottom = "";
      };
    }
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => {
      ro.disconnect();
      header.style.marginBottom = "";
      naturalRef.current = null;
      maxHeightRef.current = null;
    };
  }, [headerRef, rowInnerRef, enabled, apply]);

  return useCallback(
    (latest: { maxHeight?: string | number }) => {
      const value = latest.maxHeight;
      if (value === undefined) return;
      const px = typeof value === "number" ? value : Number.parseFloat(value);
      if (!Number.isFinite(px)) return;
      maxHeightRef.current = px;
      apply();
    },
    [apply],
  );
}

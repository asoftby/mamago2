"use client";

import { useEffect, useRef, useState } from "react";

export interface UseHideOnScrollDirectionOptions {
  /** Минимальное смещение скролла для смены состояния (px). По умолчанию 8. */
  threshold?: number;
  /** Если scrollY меньше этого значения — всегда показываем (px). По умолчанию 24. */
  topOffset?: number;
  /** Не прятать, если активен input/textarea/select. По умолчанию true. */
  respectFocus?: boolean;
}

/**
 * Возвращает `true` когда bottom bar нужно скрыть (скролл вниз),
 * `false` — показать (скролл вверх или у верха страницы).
 *
 * Throttled через requestAnimationFrame — не лагает.
 */
export function useHideOnScrollDirection({
  threshold = 8,
  topOffset = 24,
  respectFocus = true,
}: UseHideOnScrollDirectionOptions = {}): boolean {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    lastScrollY.current = window.scrollY;

    // Инициализация: если уже не у верха — проверяем начальное состояние
    if (window.scrollY > topOffset) {
      requestAnimationFrame(() => {
        if (mounted.current) setHidden(false);
      });
    }

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        ticking.current = false;

        // Не прятать, если фокус в поле ввода
        if (respectFocus) {
          const active = document.activeElement;
          if (
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement ||
            active instanceof HTMLSelectElement
          ) {
            return;
          }
        }

        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        // У верха страницы — всегда показываем
        if (currentY <= topOffset) {
          setHidden(false);
          lastScrollY.current = currentY;
          return;
        }

        if (Math.abs(delta) < threshold) {
          lastScrollY.current = currentY;
          return;
        }

        if (delta > 0) {
          // Скролл вниз → прячем
          setHidden(true);
        } else {
          // Скролл вверх → показываем
          setHidden(false);
        }

        lastScrollY.current = currentY;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      mounted.current = false;
    };
  }, [threshold, topOffset, respectFocus]);

  return hidden;
}

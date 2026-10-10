"use client";

import { useEffect, useRef, useState } from "react";

export interface UseScrollDirectionOptions {
  /** Скролл вниз больше этого значения от последней точки разворота сворачивает (px). */
  downThreshold?: number;
  /** Любой скролл вверх больше этого значения разворачивает (px). */
  upThreshold?: number;
  /** При `scrollY` меньше значения — всегда развёрнуто (px). */
  expandedAbove?: number;
  /** Вернуть `true`, чтобы не сворачивать (например, фокус внутри сворачиваемого ряда). */
  isLocked?: () => boolean;
  /** Смена значения (например, pathname) сбрасывает состояние в «развёрнуто». */
  resetKey?: string | null;
}

/**
 * `collapsed: true` — пользователь прокручивает вниз (хедер/нижний бар сворачиваем),
 * `false` — вверх или у верха страницы. Passive-слушатель + rAF; `setState` вызывается
 * только при смене значения, поэтому нет перерендеров на каждый пиксель.
 */
export function useScrollDirection({
  downThreshold = 10,
  upThreshold = 4,
  expandedAbove = 48,
  isLocked,
  resetKey = null,
}: UseScrollDirectionOptions = {}): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCollapsed(false);
  }
  const collapsedRef = useRef(false);
  const anchorY = useRef(0);
  const ticking = useRef(false);
  const isLockedRef = useRef(isLocked);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    collapsedRef.current = false;
    anchorY.current = window.scrollY;

    const apply = (next: boolean) => {
      if (collapsedRef.current === next) return;
      collapsedRef.current = next;
      setCollapsed(next);
    };

    const update = () => {
      ticking.current = false;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      // iOS rubber-band: scrollY выходит за [0, maxY] и «возвращается» — это не жест пользователя.
      const y = Math.min(Math.max(window.scrollY, 0), maxY);

      if (y < expandedAbove) {
        anchorY.current = y;
        apply(false);
        return;
      }

      if (collapsedRef.current) {
        anchorY.current = Math.max(anchorY.current, y);
        if (anchorY.current - y >= upThreshold) {
          anchorY.current = y;
          apply(false);
        }
        return;
      }

      anchorY.current = Math.min(anchorY.current, y);
      if (y - anchorY.current >= downThreshold) {
        if (isLockedRef.current?.()) {
          anchorY.current = y;
          return;
        }
        anchorY.current = y;
        apply(true);
      }
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [downThreshold, upThreshold, expandedAbove, resetKey]);

  return collapsed;
}

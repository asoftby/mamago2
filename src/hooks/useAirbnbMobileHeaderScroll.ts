"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Options = {
  maxWidthPx?: number;
  searchSurfaceOpen: boolean;
  reduceMotion: boolean | null;
  /**
   * true — раздел discovery (`/{city}/events` и т.д.): скрытие по направлению скролла
   * (вниз — прячем, вверх — показываем). false — прежняя привязка к позиции scrollY.
   */
  scrollDirectionMode?: boolean;
};

/** Целевое «сворачивание» 0…1 по scrollY — без скачков, полоса уезжает вместе со скроллом. */
function scrollYToHideTarget(y: number): number {
  if (y < 12) return 0;
  const start = 20;
  const end = 200;
  if (y >= end) return 1;
  return Math.min(1, Math.max(0, (y - start) / (end - start)));
}

/** Разделы (табы) гасятся быстрее и раньше целиком хедера — визуально мягче, без «провала». */
function scrollYToTabsOpacityTarget(y: number): number {
  if (y < 4) return 1;
  const start = 12;
  const end = 120;
  if (y >= end) return 0;
  return Math.min(1, Math.max(0, 1 - (y - start) / (end - start)));
}

const SCROLL_TOP_SHOW_PX = 12;
const DIRECTION_DELTA_PX = 0.75;

/**
 * На узком экране (max-width): поведение хедера при скролле.
 * В режиме `scrollDirectionMode` — скрытие вниз / показ вверх; иначе — по позиции scrollY.
 * 
 * ВАЖНО: Этот хук больше НЕ должен использоваться для полного скрытия header.
 * Он предназначен только для анимации табов и других внутренних элементов.
 */
export function useAirbnbMobileHeaderScroll({
  maxWidthPx = 768, // Изменено с 1023 на 768 - только для реально мобильных устройств
  searchSurfaceOpen,
  reduceMotion,
  scrollDirectionMode = false,
}: Options) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  /** 0 = полностью виден, 1 = полностью за экраном */
  const [hideRatio, setHideRatio] = useState(0);
  /** 1 = табы видны, 0 = скрыты (плавнее общего translate) */
  const [tabsOpacity, setTabsOpacity] = useState(1);
  const smoothedRef = useRef(0);
  const smoothedTabsRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const directionHideTargetRef = useRef(0);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidthPx]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      smoothedRef.current = 0;
      smoothedTabsRef.current = 1;
      directionHideTargetRef.current = 0;
      lastScrollYRef.current =
        typeof window !== "undefined" ? window.scrollY : 0;
      setHideRatio(0);
      setTabsOpacity(1);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!searchSurfaceOpen) return;
    smoothedRef.current = 0;
    smoothedTabsRef.current = 1;
    directionHideTargetRef.current = 0;
    lastScrollYRef.current = window.scrollY;
    const id = window.setTimeout(() => {
      setHideRatio(0);
      setTabsOpacity(1);
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchSurfaceOpen]);

  useEffect(() => {
    if (!enabled) {
      const id = window.setTimeout(() => {
        smoothedRef.current = 0;
        smoothedTabsRef.current = 1;
        directionHideTargetRef.current = 0;
        setHideRatio(0);
        setTabsOpacity(1);
      }, 0);
      return () => window.clearTimeout(id);
    }

    lastScrollYRef.current = window.scrollY;
    directionHideTargetRef.current = 0;

    const smooth = 0.22;
    const smoothTabs = 0.32;

    const apply = () => {
      const y = window.scrollY;
      let target: number;
      let targetTabs: number;

      if (searchSurfaceOpen) {
        target = 0;
        targetTabs = 1;
      } else if (scrollDirectionMode) {
        if (y < SCROLL_TOP_SHOW_PX) {
          directionHideTargetRef.current = 0;
          target = 0;
          targetTabs = 1;
        } else {
          const delta = y - lastScrollYRef.current;
          if (delta > DIRECTION_DELTA_PX) {
            directionHideTargetRef.current = 1;
          } else if (delta < -DIRECTION_DELTA_PX) {
            directionHideTargetRef.current = 0;
          }
          target = directionHideTargetRef.current;
          targetTabs = target >= 0.5 ? 0 : 1;
        }
        lastScrollYRef.current = y;
      } else {
        target = scrollYToHideTarget(y);
        targetTabs = scrollYToTabsOpacityTarget(y);
      }

      if (reduceMotion) {
        smoothedRef.current = target;
        smoothedTabsRef.current = targetTabs;
        setHideRatio(target);
        setTabsOpacity(targetTabs);
        return;
      }

      const prev = smoothedRef.current;
      const next =
        Math.abs(target - prev) < 0.002 ? target : prev + (target - prev) * smooth;
      smoothedRef.current = next;
      setHideRatio(next);

      const prevT = smoothedTabsRef.current;
      const nextT =
        Math.abs(targetTabs - prevT) < 0.002
          ? targetTabs
          : prevT + (targetTabs - prevT) * smoothTabs;
      smoothedTabsRef.current = nextT;
      setTabsOpacity(nextT);

      if (
        Math.abs(next - target) > 0.004 ||
        Math.abs(nextT - targetTabs) > 0.004
      ) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          apply();
        });
      }
    };

    const onScroll = () => {
      if (searchSurfaceOpen) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        apply();
      });
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, searchSurfaceOpen, pathname, reduceMotion, scrollDirectionMode]);

  const fullyHidden = hideRatio > 0.96;

  return {
    enabled,
    /** @deprecated используйте fullyHidden или hideRatio */
    hidden: fullyHidden,
    hideRatio,
    fullyHidden,
    /** Плавное затухание строки с разделами (раньше, чем целиком уезжает хедер). */
    tabsOpacity,
  };
}

"use client";

import { useState, useEffect, useCallback, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";

export type HeaderMode = "expanded-top" | "compact" | "expanded-overlay";
export type HeaderPanel = "none" | "where" | "when" | "who" | "filters";

interface StableHeaderBehaviorState {
  mode: HeaderMode;
  activePanel: HeaderPanel;
  showSearchSurface: boolean;
  isScrolled: boolean;
  /** 0 at top, 1 at scrollThreshold and above — for scroll-linked smooth transition */
  scrollProgress: number;
}

interface StableHeaderBehaviorActions {
  openPanel: (panel: HeaderPanel) => void;
  closePanel: () => void;
  openSearchSurface: () => void;
  closeSearchSurface: () => void;
  toggleSearchSurface: () => void;
}

interface UseStableHeaderBehaviorOptions {
  scrollThreshold?: number;
  /**
   * Гистерезис (px): компакт включается позже, выключается раньше — меньше рывков на iOS (rubber band, subpixel scroll).
   */
  scrollHysteresisPx?: number;
  /**
   * Ref на корневой `<header>` (верхняя + нижняя строка).
   * Клик вне `data-header-chrome` / `data-search-surface` / `[data-portal-panel]` закрывает панели.
   */
  headerRef?: RefObject<HTMLElement | null>;
}

/** Блок 2 — компактная строка (лого, капсула, действия), px. */
export const STABLE_HEADER_BLOCK2_PX = 80;
/** Блок 1 — оценка высоты второй строки; спейсер на десктопе подгоняется по ResizeObserver в Header. */
export const STABLE_HEADER_BLOCK1_DEFAULT_PX = 176;
/**
 * Раньше было больше при «открытой» surface — из‑за этого спейсер подскакивал и контент съезжал.
 * Панели Where/When/Who в портале; высота полосы фиксирована — держим одно значение с DEFAULT.
 */
export const STABLE_HEADER_BLOCK1_OPEN_PX = STABLE_HEADER_BLOCK1_DEFAULT_PX;
/** @deprecated используйте STABLE_HEADER_BLOCK2_PX */
export const STABLE_HEADER_TOP_ROW_PX = STABLE_HEADER_BLOCK2_PX;
/** @deprecated */
export const STABLE_HEADER_OPEN_TOTAL_PX =
  STABLE_HEADER_BLOCK2_PX + STABLE_HEADER_BLOCK1_OPEN_PX;

/** Режим при однократном чтении scrollY (без гистерезиса по prev.mode) — порог «вошли в компакт». */
function modeFromScrollY(scrollY: number, enterCompactY: number): HeaderMode {
  return scrollY >= enterCompactY ? "compact" : "expanded-top";
}

/**
 * Stable Header Behavior Hook
 *
 * Airbnb-лайаут:
 * - **Верхняя строка** (`data-header-chrome`, `data-header-block2`): лого | центр (навигация или компактная капсула) | глобус и меню.
 * - **Нижняя строка** (`data-header-block1`, `data-search-surface`): большая сегментированная строка поиска — только когда не компактная одна строка.
 *
 * Видимость:
 * - У верха (`expanded-top`, без открытой search surface): две строки — навигация + большой поиск.
 * - После скролла (`compact`): одна строка — компактная капсула в центре.
 * - `showSearchSurface === true`: две строки (навигация + расширенная форма), даже при скролле.
 */
export function useStableHeaderBehavior(options: UseStableHeaderBehaviorOptions = {}) {
  const { scrollThreshold = 80, scrollHysteresisPx = 14, headerRef } = options;
  const pathname = usePathname();

  /** Вниз: компакт после threshold + hysteresis; вверх: разворот раньше threshold. */
  const enterCompactY = scrollThreshold + Math.max(4, Math.round(scrollHysteresisPx * 0.45));
  const exitCompactY = Math.max(8, scrollThreshold - scrollHysteresisPx);

  const [state, setState] = useState<StableHeaderBehaviorState>(() => {
    if (typeof window === "undefined") {
      return {
        mode: "expanded-top",
        activePanel: "none",
        showSearchSurface: false,
        isScrolled: false,
        scrollProgress: 0,
      };
    }
    const y = window.scrollY;
    const progress = Math.min(1, y / scrollThreshold);
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const mode: HeaderMode = mobile
      ? "expanded-top"
      : y >= enterCompactY
        ? "compact"
        : "expanded-top";
    return {
      mode,
      activePanel: "none",
      showSearchSurface: false,
      isScrolled: y > 10,
      scrollProgress: progress,
    };
  });

  const rafRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const actionsRef = useRef<StableHeaderBehaviorActions>(null!);
  const stateRef = useRef(state);
  const forceExpandedUntilRef = useRef<number>(0);
  /** Ниже lg: компактная строка отключена — скрытие через translate (см. useAirbnbMobileHeaderScroll). */
  const isMobileLayoutRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      isMobileLayoutRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const updateFromScroll = useCallback(() => {
    rafRef.current = null;
    const currentScrollY = window.scrollY;
    const progress = Math.min(1, currentScrollY / scrollThreshold);

    setState((prev) => {
      if (prev.showSearchSurface) {
        return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
      }

      if (Date.now() < forceExpandedUntilRef.current) {
        return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
      }

      if (isMobileLayoutRef.current) {
        if (prev.mode !== "expanded-top") {
          return {
            ...prev,
            mode: "expanded-top",
            isScrolled: currentScrollY > 10,
            scrollProgress: progress,
            activePanel: prev.activePanel,
            showSearchSurface: false,
          };
        }
        return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
      }

      let nextMode = prev.mode;
      if (prev.mode === "expanded-top" && currentScrollY >= enterCompactY) {
        nextMode = "compact";
      } else if (prev.mode === "compact" && currentScrollY < exitCompactY) {
        nextMode = "expanded-top";
      }

      if (nextMode !== prev.mode) {
        return {
          ...prev,
          mode: nextMode,
          isScrolled: currentScrollY > 10,
          scrollProgress: progress,
          activePanel: nextMode === "compact" ? "none" : prev.activePanel,
          showSearchSurface: nextMode === "compact" ? false : prev.showSearchSurface,
        };
      }

      return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
    });

    lastScrollYRef.current = currentScrollY;
  }, [scrollThreshold, enterCompactY, exitCompactY]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(updateFromScroll);
  }, [updateFromScroll]);

  /**
   * Закрытие поиска при осознанном скролле страницы.
   * Нельзя брать scrollY до отрисовки второй строки хедера: спейсер и reflow меняют scrollY на несколько px,
   * из‑за чего surface открывалась и тут же закрывалась (~100ms + delta > 10).
   */
  useEffect(() => {
    if (!state.showSearchSurface && state.activePanel === "none") return;

    let baselineScrollY = window.scrollY;
    let isReady = false;

    const readyTimeout = setTimeout(() => {
      baselineScrollY = window.scrollY;
      isReady = true;
    }, 400);

    const handleScrollForClose = () => {
      if (!isReady) return;

      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - baselineScrollY);

      // Порог выше микродрожи от смены высоты layout / subpixel
      if (scrollDelta > 48) {
        setState((prev) => {
          if (!prev.showSearchSurface && prev.activePanel === "none") return prev;
          const targetMode = modeFromScrollY(currentScrollY, enterCompactY);
          return {
            ...prev,
            showSearchSurface: false,
            activePanel: "none",
            mode: targetMode,
          };
        });
      }
    };

    window.addEventListener("scroll", handleScrollForClose, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollForClose);
      clearTimeout(readyTimeout);
    };
  }, [state.showSearchSurface, state.activePanel, scrollThreshold, enterCompactY]);

  useEffect(() => {
    const y = window.scrollY;
    lastScrollYRef.current = y;

    window.addEventListener("scroll", handleScroll, { passive: true });
    const vv = window.visualViewport;
    /** Только resize (полоса URL): `scroll` на visualViewport на iOS дублирует window и даёт лишние пересчёты режима. */
    const onViewportResize = () => {
      handleScroll();
    };
    vv?.addEventListener("resize", onViewportResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      vv?.removeEventListener("resize", onViewportResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, scrollThreshold, pathname, enterCompactY, exitCompactY]);

  const actions: StableHeaderBehaviorActions = {
    openPanel: useCallback(
      (panel: HeaderPanel) => {
        setState((prev) => ({
          ...prev,
          activePanel: panel,
          /** Открытие сегмента Where/When/Who — показываем оба блока (в т.ч. компактную строку). */
          showSearchSurface: true,
        }));
      },
      [],
    ),

    closePanel: useCallback(() => {
      setState((prev) => ({
        ...prev,
        activePanel: "none",
      }));
    }, []),

    openSearchSurface: useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      forceExpandedUntilRef.current = Date.now() + 500;
      lastScrollYRef.current = window.scrollY;

      setState((prev) => {
        const y = window.scrollY;
        return {
          ...prev,
          showSearchSurface: true,
          mode: modeFromScrollY(y, enterCompactY),
          activePanel: "none",
        };
      });
    }, [enterCompactY]),

    closeSearchSurface: useCallback(() => {
      setState((prev) => {
        const currentScrollY = window.scrollY;
        const targetMode = modeFromScrollY(currentScrollY, enterCompactY);
        return {
          ...prev,
          showSearchSurface: false,
          mode: targetMode,
          activePanel: "none",
        };
      });
    }, [enterCompactY]),

    toggleSearchSurface: useCallback(() => {
      setState((prev) => {
        if (prev.showSearchSurface) {
          const currentScrollY = window.scrollY;
          const targetMode = modeFromScrollY(currentScrollY, enterCompactY);
          return {
            ...prev,
            showSearchSurface: false,
            mode: targetMode,
            activePanel: "none",
          };
        }
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        forceExpandedUntilRef.current = Date.now() + 500;
        lastScrollYRef.current = window.scrollY;
        const y = window.scrollY;
        return {
          ...prev,
          showSearchSurface: true,
          mode: modeFromScrollY(y, enterCompactY),
        };
      });
    }, [enterCompactY]),
  };

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const current = stateRef.current;
      if (!current.showSearchSurface && current.activePanel === "none") return;

      const target = event.target as Node;
      const root = headerRef?.current;
      const block1 = document.querySelector("[data-header-block1]");
      const block2 = document.querySelector("[data-header-block2]");
      const inRoot = root?.contains(target) ?? false;
      const inB1 = block1?.contains(target) ?? false;
      const inB2 = block2?.contains(target) ?? false;
      const inPanel = Array.from(document.querySelectorAll("[data-portal-panel]")).some((el) =>
        el.contains(target),
      );

      const searchSurface = document.querySelector("[data-search-surface]");
      const inSearchSurface = searchSurface?.contains(target) ?? false;

      if (inRoot || inB1 || inB2 || inPanel || inSearchSurface) return;

      if (current.activePanel !== "none") {
        actionsRef.current.closePanel();
      } else if (current.showSearchSurface) {
        actionsRef.current.closeSearchSurface();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [state.showSearchSurface, state.activePanel, headerRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (state.showSearchSurface) actionsRef.current.closeSearchSurface();
      else if (state.activePanel !== "none") actionsRef.current.closePanel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.showSearchSurface, state.activePanel]);

  /** Одна компактная строка (лого + капсула + действия), без второй строки поиска. */
  const showAirbnbCompactBar = state.mode === "compact" && !state.showSearchSurface;

  return {
    ...state,
    actions,
    isExpanded: state.mode === "expanded-top",
    isCompact: state.mode === "compact",
    isOverlay: state.mode === "expanded-overlay",
    hasActivePanel: state.activePanel !== "none",
    showAirbnbCompactBar,
  };
}

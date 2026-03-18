"use client";

import { useState, useEffect, useCallback, useRef, type RefObject } from "react";

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
  /** Ref на корень хедера (форма внутри). Нужен для надёжной проверки «клик вне формы». */
  headerRef?: RefObject<HTMLElement | null>;
}

/**
 * Stable Header Behavior Hook
 * 
 * Production-grade behavioral controller for desktop header.
 * Eliminates layout shift and reflow by managing state transitions
 * without changing header height or causing DOM restructuring.
 */
export function useStableHeaderBehavior(options: UseStableHeaderBehaviorOptions = {}) {
  const { scrollThreshold = 80, headerRef } = options;

  const [state, setState] = useState<StableHeaderBehaviorState>({
    mode: "expanded-top",
    activePanel: "none",
    showSearchSurface: false,
    isScrolled: false,
    scrollProgress: 0
  });

  const rafRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const actionsRef = useRef<StableHeaderBehaviorActions>(null!);
  const stateRef = useRef(state);
  const forceExpandedUntilRef = useRef<number>(0); // timestamp до которого игнорируем скролл
  stateRef.current = state;

  const updateFromScroll = useCallback(() => {
    rafRef.current = null;
    const currentScrollY = window.scrollY;
    const progress = Math.min(1, currentScrollY / scrollThreshold);
    const wasAboveThreshold = lastScrollYRef.current >= scrollThreshold;
    const isAboveThreshold = currentScrollY >= scrollThreshold;

    setState(prev => {
      // Если SearchSurface открыт, не меняем режим при обычном скролле
      if (prev.showSearchSurface) {
        return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
      }
      
      // Если принудительно expanded — игнорируем скролл
      if (Date.now() < forceExpandedUntilRef.current) {
        return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
      }
      
      // Если expanded-top открыт принудительно (через клик на компактный) и мы выше threshold — сворачиваем
      if (prev.mode === "expanded-top" && isAboveThreshold) {
        return {
          ...prev,
          mode: "compact",
          isScrolled: currentScrollY > 10,
          scrollProgress: progress,
          activePanel: "none"
        };
      }

      // Обычная логика переключения режимов (пересечение threshold)
      if (wasAboveThreshold !== isAboveThreshold) {
        const newMode: HeaderMode = isAboveThreshold ? "compact" : "expanded-top";
        return {
          ...prev,
          mode: newMode,
          isScrolled: currentScrollY > 10,
          scrollProgress: progress,
          activePanel: newMode === "compact" ? "none" : prev.activePanel
        };
      }
      
      return { ...prev, isScrolled: currentScrollY > 10, scrollProgress: progress };
    });

    lastScrollYRef.current = currentScrollY;
  }, [scrollThreshold]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(updateFromScroll);
  }, [updateFromScroll]);

  // Обработчик для закрытия search surface и панелей при скролле
  useEffect(() => {
    if (!state.showSearchSurface && state.activePanel === "none") return;

    let initialScrollY = window.scrollY;
    let isReady = false;

    const readyTimeout = setTimeout(() => {
      isReady = true;
    }, 100);

    const handleScrollForClose = () => {
      if (!isReady) return;
      
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - initialScrollY);
      
      if (scrollDelta > 10) {
        setState(prev => {
          if (!prev.showSearchSurface && prev.activePanel === "none") return prev;
          const targetMode: HeaderMode = currentScrollY < scrollThreshold ? "expanded-top" : "compact";
          return {
            ...prev,
            showSearchSurface: false,
            activePanel: "none",
            mode: targetMode
          };
        });
      }
    };

    initialScrollY = window.scrollY;
    window.addEventListener("scroll", handleScrollForClose, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollForClose);
      clearTimeout(readyTimeout);
    };
  }, [state.showSearchSurface, state.activePanel, scrollThreshold]);

  useEffect(() => {
    const y = window.scrollY;
    lastScrollYRef.current = y;
    const progress = Math.min(1, y / scrollThreshold);
    const atTop = progress < 1;
    setState(prev => ({
      ...prev,
      scrollProgress: progress,
      mode: atTop ? "expanded-top" : "compact",
      isScrolled: y > 10
    }));

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, scrollThreshold]);
  
  // Actions (stable callbacks)
  const actions: StableHeaderBehaviorActions = {
    openPanel: useCallback((panel: HeaderPanel) => {
      setState(prev => ({
        ...prev,
        activePanel: panel,
        // If we're in compact mode and opening a panel, show search surface
        showSearchSurface: prev.mode === "compact" ? true : prev.showSearchSurface,
        mode: prev.mode === "compact" ? "expanded-overlay" : prev.mode
      }));
    }, []),
    
    closePanel: useCallback(() => {
      setState(prev => ({
        ...prev,
        activePanel: "none"
      }));
    }, []),
    
    openSearchSurface: useCallback(() => {
      // Отменяем любой pending RAF чтобы не было гонки
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Защита: игнорируем скролл 500ms после открытия
      forceExpandedUntilRef.current = Date.now() + 500;
      // Устанавливаем lastScrollYRef на текущую позицию чтобы не было ложного срабатывания
      lastScrollYRef.current = window.scrollY;
      
      setState(prev => ({
        ...prev,
        showSearchSurface: false,
        mode: "expanded-top" as HeaderMode
      }));
    }, []),
    
    closeSearchSurface: useCallback(() => {
      console.log('🔍 closeSearchSurface called');
      setState(prev => {
        // Determine target mode based on scroll position
        const currentScrollY = window.scrollY;
        const targetMode: HeaderMode = currentScrollY < scrollThreshold ? "expanded-top" : "compact";
        
        console.log('🔍 Closing SearchSurface, targetMode:', targetMode, 'scrollY:', currentScrollY);
        
        return {
          ...prev,
          showSearchSurface: false,
          mode: targetMode,
          activePanel: "none"
        };
      });
    }, [scrollThreshold]),
    
    toggleSearchSurface: useCallback(() => {
      setState(prev => {
        if (prev.showSearchSurface) {
          // Close search surface
          const currentScrollY = window.scrollY;
          const targetMode: HeaderMode = currentScrollY < scrollThreshold ? "expanded-top" : "compact";
          
          return {
            ...prev,
            showSearchSurface: false,
            mode: targetMode,
            activePanel: "none"
          };
        } else {
          // Open search surface
          return {
            ...prev,
            showSearchSurface: true,
            mode: "expanded-overlay"
          };
        }
      });
    }, [scrollThreshold])
  };
  
  actionsRef.current = actions;
  
  // Outside click — закрыть выпадающую панель или (если открыт хедер из компактного) поверхность
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const current = stateRef.current;
      if (!current.showSearchSurface && current.activePanel === "none") return;

      const target = event.target as Node;
      const headerEl = headerRef?.current ?? document.querySelector("[data-header-chrome]");
      const inHeader = headerEl?.contains(target) ?? false;
      const inPanel = Array.from(document.querySelectorAll("[data-portal-panel]")).some((el) =>
        el.contains(target)
      );
      
      // Проверяем клик по search surface
      const searchSurface = document.querySelector("[data-search-surface]");
      const inSearchSurface = searchSurface?.contains(target) ?? false;
      
      if (inHeader || inPanel || inSearchSurface) return;

      if (current.activePanel !== "none") {
        actionsRef.current.closePanel();
      } else if (current.showSearchSurface) {
        actionsRef.current.closeSearchSurface();
      }
    };

    // Добавляем задержку перед активацией outside click handler
    // Это предотвращает немедленное закрытие после открытия
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    }, 150); // Increased from 100ms to 150ms

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [state.showSearchSurface, state.activePanel, headerRef]);
  
  // Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (state.showSearchSurface) actionsRef.current.closeSearchSurface();
      else if (state.activePanel !== "none") actionsRef.current.closePanel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.showSearchSurface, state.activePanel]);
  
  return {
    ...state,
    actions,
    // Computed properties for easier consumption
    isExpanded: state.mode === "expanded-top",
    isCompact: state.mode === "compact",
    isOverlay: state.mode === "expanded-overlay",
    hasActivePanel: state.activePanel !== "none"
  };
}
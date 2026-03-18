"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type HeaderMode = "expanded" | "compact";
export type HeaderPanel = "none" | "where" | "when" | "who" | "filters";

interface HeaderBehaviorState {
  mode: HeaderMode;
  isScrolled: boolean;
}

interface HeaderBehaviorActions {
  showExtension: () => void;
  hideExtension: () => void;
  toggleExtension: () => void;
  openPanel: (panel: HeaderPanel) => void;
  closePanel: () => void;
}

interface UseHeaderBehaviorOptions {
  scrollThreshold?: number;
  debounceMs?: number;
}

/**
 * Header Behavior Hook
 * 
 * Простой behavioral controller для desktop header.
 * Управляет только двумя состояниями: expanded/compact.
 * 
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 * - Отслеживает threshold
 * - Меняет состояние header
 * - НЕ вызывает React re-render на каждый пиксель scroll
 * - State меняется только при переходе порога
 */
export function useHeaderBehavior(options: UseHeaderBehaviorOptions = {}) {
  const { scrollThreshold = 80, debounceMs = 16 } = options;
  
  // Инициализируем состояние на основе текущей позиции скролла
  const [state, setState] = useState<HeaderBehaviorState>(() => {
    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    return {
      mode: currentScrollY < scrollThreshold ? "expanded" : "compact",
      isScrolled: currentScrollY > 10
    };
  });
  
  const [showExtension, setShowExtension] = useState(false);
  const [activePanel, setActivePanel] = useState<HeaderPanel>("none");
  
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef(0);
  
  // Debounced scroll handler - для переключения режимов header
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const currentScrollY = window.scrollY;
      const wasAboveThreshold = lastScrollYRef.current < scrollThreshold;
      const isAboveThreshold = currentScrollY < scrollThreshold;
      
      // Обновляем состояние при пересечении порога
      if (wasAboveThreshold !== isAboveThreshold) {
        const newMode: HeaderMode = isAboveThreshold ? "expanded" : "compact";
        
        setState(prev => ({
          ...prev,
          mode: newMode,
          isScrolled: currentScrollY > 10
        }));
      } else {
        // Обновляем только scroll state для shadow effect
        setState(prev => ({
          ...prev,
          isScrolled: currentScrollY > 10
        }));
      }
      
      lastScrollYRef.current = currentScrollY;
    }, debounceMs);
  }, [scrollThreshold, debounceMs]);
  
  // Setup scroll listener
  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    
    // Простой обработчик для закрытия extension при скролле
    const onScrollForExtension = () => {
      if (showExtension) {
        setShowExtension(false);
        setActivePanel("none");
      }
    };
    
    // Debounced handler для остальной логики
    const onScroll = () => {
      handleScroll();
    };
    
    // Добавляем оба обработчика
    window.addEventListener("scroll", onScrollForExtension, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", onScrollForExtension);
      window.removeEventListener("scroll", onScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, showExtension]);
  
  // Actions
  const actions: HeaderBehaviorActions = {
    showExtension: useCallback(() => {
      setShowExtension(true);
    }, []),
    
    hideExtension: useCallback(() => {
      setShowExtension(false);
      setActivePanel("none");
    }, []),
    
    toggleExtension: useCallback(() => {
      setShowExtension(prev => !prev);
      if (!showExtension) {
        setActivePanel("none");
      }
    }, [showExtension]),
    
    openPanel: useCallback((panel: HeaderPanel) => {
      setActivePanel(panel);
      setShowExtension(true);
    }, []),
    
    closePanel: useCallback(() => {
      setActivePanel("none");
    }, [])
  };
  
  // Handle outside clicks to hide extension
  useEffect(() => {
    // Только если extension показан или есть активная панель
    if (!showExtension && activePanel === "none") {
      return;
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Проверяем клик внутри header chrome
      const headerChrome = document.querySelector('[data-header-chrome]');
      if (headerChrome && headerChrome.contains(target)) {
        return;
      }
      
      // Проверяем клик внутри header extension
      const headerExtension = document.querySelector('[data-header-extension]');
      if (headerExtension && headerExtension.contains(target)) {
        return;
      }
      
      // Проверяем клик внутри любых portal панелей (dropdown'ы поиска)
      const portalPanels = document.querySelectorAll('[data-portal-panel]');
      for (const panel of portalPanels) {
        if (panel.contains(target)) {
          return;
        }
      }
      
      // Дополнительная проверка на элементы поиска по классам
      if (target.closest('.search-panel') || 
          target.closest('.dropdown-panel') ||
          target.closest('[role="dialog"]') ||
          target.closest('[role="menu"]')) {
        return;
      }
      
      // Клик снаружи - закрываем extension
      actions.hideExtension();
    };
    
    // Используем capture phase для более надежного перехвата
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [showExtension, activePanel, actions]);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activePanel !== "none") {
          actions.closePanel();
        } else if (showExtension) {
          actions.hideExtension();
        }
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showExtension, activePanel, actions]);
  
  return {
    ...state,
    showExtension,
    activePanel,
    actions,
    // Computed properties
    isExpanded: state.mode === "expanded",
    isCompact: state.mode === "compact",
    hasActivePanel: activePanel !== "none"
  };
}
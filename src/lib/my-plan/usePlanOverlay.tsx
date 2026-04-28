"use client";

/**
 * usePlanOverlay — единый контроллер открытия/закрытия оверлея "Мой план".
 *
 * Управляет ТОЛЬКО состоянием overlay (isOpen).
 * Не дублирует store плана (useMyPlan).
 *
 * Использование:
 *   const { open, close, toggle, isOpen } = usePlanOverlay();
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface PlanOverlayContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const PlanOverlayContext = createContext<PlanOverlayContextValue | null>(null);

export function PlanOverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <PlanOverlayContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </PlanOverlayContext.Provider>
  );
}

export function usePlanOverlay(): PlanOverlayContextValue {
  const ctx = useContext(PlanOverlayContext);
  if (!ctx) {
    throw new Error("usePlanOverlay must be used within PlanOverlayProvider");
  }
  return ctx;
}

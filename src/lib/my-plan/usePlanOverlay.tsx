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
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

/** A screen the plan should land on when it opens (e.g. «Куда пойти» → «Собрать день»). */
export type PlanLanding = "dayScenario";

export type PlanOverlayState = { isOpen: boolean; landing: PlanLanding | null };
export type PlanOverlayAction =
  | { type: "open"; landing?: PlanLanding | null }
  | { type: "close" }
  | { type: "toggle" }
  | { type: "clearLanding" };

export function planOverlayReducer(state: PlanOverlayState, action: PlanOverlayAction): PlanOverlayState {
  switch (action.type) {
    // Opening without a landing keeps what an earlier open asked for only while it is still open.
    case "open":
      return { isOpen: true, landing: action.landing ?? null };
    case "close":
      return { isOpen: false, landing: null };
    case "toggle":
      return state.isOpen ? { isOpen: false, landing: null } : { isOpen: true, landing: null };
    case "clearLanding":
      return state.landing === null ? state : { ...state, landing: null };
  }
}

interface PlanOverlayContextValue {
  isOpen: boolean;
  /** The screen the open plan should land on; stays set until the plan closes or the user leaves that screen. */
  landing: PlanLanding | null;
  open: (landing?: PlanLanding) => void;
  close: () => void;
  toggle: () => void;
  clearLanding: () => void;
}

const PlanOverlayContext = createContext<PlanOverlayContextValue | null>(null);

export function PlanOverlayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(planOverlayReducer, { isOpen: false, landing: null });

  const open = useCallback((landing?: PlanLanding) => dispatch({ type: "open", landing }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const toggle = useCallback(() => dispatch({ type: "toggle" }), []);
  const clearLanding = useCallback(() => dispatch({ type: "clearLanding" }), []);
  const value = useMemo(
    () => ({ isOpen: state.isOpen, landing: state.landing, open, close, toggle, clearLanding }),
    [state, open, close, toggle, clearLanding],
  );

  return <PlanOverlayContext.Provider value={value}>{children}</PlanOverlayContext.Provider>;
}

/** For content that may render outside the overlay (no provider): null instead of throwing. */
export function useOptionalPlanOverlay(): PlanOverlayContextValue | null {
  return useContext(PlanOverlayContext);
}

export function usePlanOverlay(): PlanOverlayContextValue {
  const ctx = useContext(PlanOverlayContext);
  if (!ctx) {
    throw new Error("usePlanOverlay must be used within PlanOverlayProvider");
  }
  return ctx;
}

/**
 * Pending Action Manager
 * 
 * Единый менеджер для всех pending actions
 * Заменяет разрозненные реализации (birthday builder и т.д.)
 */

import type { PendingAction } from "./types";

const STORAGE_KEY = "mamaGo_pending_action_v1";
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Set pending action
 */
export function setPendingAction(action: Omit<PendingAction, "createdAt">): void {
  if (typeof window === "undefined") return;
  
  const fullAction: PendingAction = {
    ...action,
    createdAt: Date.now(),
    ttl: action.ttl || DEFAULT_TTL,
  };
  
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fullAction));
  } catch (error) {
    console.error("Failed to set pending action:", error);
  }
}

/**
 * Get pending action (without consuming)
 */
export function getPendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const action = JSON.parse(raw) as PendingAction;
    
    // Check TTL
    if (action.ttl && Date.now() - action.createdAt > action.ttl) {
      clearPendingAction();
      return null;
    }
    
    return action;
  } catch (error) {
    console.error("Failed to get pending action:", error);
    return null;
  }
}

/**
 * Consume pending action (get and clear)
 */
export function consumePendingAction(): PendingAction | null {
  const action = getPendingAction();
  if (action) {
    clearPendingAction();
  }
  return action;
}

/**
 * Clear pending action
 */
export function clearPendingAction(): void {
  if (typeof window === "undefined") return;
  
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear pending action:", error);
  }
}

/**
 * Check if there's a pending action
 */
export function hasPendingAction(): boolean {
  return getPendingAction() !== null;
}

/**
 * Update pending action payload
 */
export function updatePendingAction(
  updates: Partial<Omit<PendingAction, "createdAt">>
): void {
  const current = getPendingAction();
  if (!current) return;
  
  setPendingAction({
    ...current,
    ...updates,
  });
}

// ============================================================================
// Typed helpers for specific action types
// ============================================================================

/**
 * Save event action
 */
export interface SaveEventAction {
  type: "saveEvent";
  payload: {
    activityId: string;
    activityTitle?: string;
  };
}

export function setPendingSaveEvent(activityId: string, activityTitle?: string): void {
  setPendingAction({
    type: "saveEvent",
    payload: { activityId, activityTitle },
  });
}

/**
 * Save event with date action
 */
export interface SaveEventWithDateAction {
  type: "saveEventWithDate";
  payload: {
    activityId: string;
    activityTitle?: string;
    date: string;
    timeSlot?: string;
  };
}

export function setPendingSaveEventWithDate(
  activityId: string,
  date: string,
  options?: { activityTitle?: string; timeSlot?: string }
): void {
  setPendingAction({
    type: "saveEventWithDate",
    payload: {
      activityId,
      date,
      activityTitle: options?.activityTitle,
      timeSlot: options?.timeSlot,
    },
  });
}

/**
 * Open plan action
 */
export interface OpenPlanAction {
  type: "openPlan";
  payload: {
    date?: string;
    firstRun?: boolean;
  };
}

export function setPendingOpenPlan(options?: { date?: string; firstRun?: boolean }): void {
  setPendingAction({
    type: "openPlan",
    payload: {
      date: options?.date,
      firstRun: options?.firstRun,
    },
  });
}

/**
 * Birthday constructor action
 */
export interface BirthdayConstructorAction {
  type: "birthdayConstructor";
  payload: {
    action: "selectBase" | "toggleAddon";
    offerId: string;
  };
}

export function setPendingBirthdayAction(
  action: "selectBase" | "toggleAddon",
  offerId: string
): void {
  setPendingAction({
    type: "birthdayConstructor",
    payload: { action, offerId },
  });
}

/**
 * Review creation action
 */
export interface CreateReviewAction {
  type: "createReview";
  payload: {
    activityId: string;
    rating?: number;
    text?: string;
  };
}

export function setPendingCreateReview(
  activityId: string,
  options?: { rating?: number; text?: string }
): void {
  setPendingAction({
    type: "createReview",
    payload: {
      activityId,
      rating: options?.rating,
      text: options?.text,
    },
  });
}

/**
 * Save route to plan action
 */
export interface SaveRouteToPlanAction {
  type: "saveRouteToPlan";
  payload: {
    routeId: string;
    routeSlug: string;
    routeTitle?: string;
    coverImageUrl?: string;
    date: string;
  };
}

export function setPendingSaveRouteToPlan(
  routeId: string,
  routeSlug: string,
  date: string,
  options?: { routeTitle?: string; coverImageUrl?: string }
): void {
  setPendingAction({
    type: "saveRouteToPlan",
    payload: {
      routeId,
      routeSlug,
      date,
      routeTitle: options?.routeTitle,
      coverImageUrl: options?.coverImageUrl,
    },
  });
}

/**
 * Save route to ideas action
 */
export interface SaveRouteToIdeasAction {
  type: "saveRouteToIdeas";
  payload: {
    routeId: string;
    routeSlug: string;
    routeTitle?: string;
    coverImageUrl?: string;
  };
}

export function setPendingSaveRouteToIdeas(
  routeId: string,
  routeSlug: string,
  options?: { routeTitle?: string; coverImageUrl?: string }
): void {
  setPendingAction({
    type: "saveRouteToIdeas",
    payload: {
      routeId,
      routeSlug,
      routeTitle: options?.routeTitle,
      coverImageUrl: options?.coverImageUrl,
    },
  });
}

/**
 * Type guard for pending actions
 */
export function isSaveEventAction(action: PendingAction): action is SaveEventAction {
  return action.type === "saveEvent";
}

export function isSaveEventWithDateAction(
  action: PendingAction
): action is SaveEventWithDateAction {
  return action.type === "saveEventWithDate";
}

export function isOpenPlanAction(action: PendingAction): action is OpenPlanAction {
  return action.type === "openPlan";
}

export function isBirthdayConstructorAction(
  action: PendingAction
): action is BirthdayConstructorAction {
  return action.type === "birthdayConstructor";
}

export function isCreateReviewAction(action: PendingAction): action is CreateReviewAction {
  return action.type === "createReview";
}

export function isSaveRouteToPlanAction(
  action: PendingAction
): action is SaveRouteToPlanAction {
  return action.type === "saveRouteToPlan";
}

export function isSaveRouteToIdeasAction(
  action: PendingAction
): action is SaveRouteToIdeasAction {
  return action.type === "saveRouteToIdeas";
}

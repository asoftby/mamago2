/**
 * Onboarding Context Manager
 * 
 * Управление контекстом onboarding flow
 */

import type { OnboardingContext, OnboardingEntryPoint } from "./types";
import { getScenario, resolveIntent } from "./scenarioRegistry";
import { getPendingAction } from "./pendingActionManager";

const CONTEXT_KEY = "mamaGo_onboarding_context_v1";
const CONTEXT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Create onboarding context
 */
export function createOnboardingContext(
  entryPoint: OnboardingEntryPoint,
  options?: {
    returnUrl?: string;
    analyticsMetadata?: Record<string, unknown>;
  }
): OnboardingContext {
  const scenario = getScenario(entryPoint);
  const pendingAction = getPendingAction();
  const intent = resolveIntent(entryPoint, { pendingAction: pendingAction || undefined });
  
  const context: OnboardingContext = {
    entryPoint,
    intent,
    outcome: scenario.completionStrategy.outcome,
    requiredFields: scenario.requiredFields,
    deferredFields: scenario.optionalFields,
    returnUrl: options?.returnUrl,
    pendingAction: pendingAction || undefined,
    analyticsMetadata: {
      ...scenario.analyticsMetadata,
      ...options?.analyticsMetadata,
    },
    createdAt: Date.now(),
  };
  
  return context;
}

/**
 * Save onboarding context
 */
export function saveOnboardingContext(context: OnboardingContext): void {
  if (typeof window === "undefined") return;
  
  try {
    window.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.error("Failed to save onboarding context:", error);
  }
}

/**
 * Get onboarding context
 */
export function getOnboardingContext(): OnboardingContext | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = window.sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    
    const context = JSON.parse(raw) as OnboardingContext;
    
    // Check TTL
    if (Date.now() - context.createdAt > CONTEXT_TTL) {
      clearOnboardingContext();
      return null;
    }
    
    return context;
  } catch (error) {
    console.error("Failed to get onboarding context:", error);
    return null;
  }
}

/**
 * Clear onboarding context
 */
export function clearOnboardingContext(): void {
  if (typeof window === "undefined") return;
  
  try {
    window.sessionStorage.removeItem(CONTEXT_KEY);
  } catch (error) {
    console.error("Failed to clear onboarding context:", error);
  }
}

/**
 * Update onboarding context
 */
export function updateOnboardingContext(
  updates: Partial<Omit<OnboardingContext, "createdAt">>
): void {
  const current = getOnboardingContext();
  if (!current) return;
  
  const updated: OnboardingContext = {
    ...current,
    ...updates,
  };
  
  saveOnboardingContext(updated);
}

/**
 * Initialize onboarding context for entry point
 */
export function initOnboardingContext(
  entryPoint: OnboardingEntryPoint,
  options?: {
    returnUrl?: string;
    analyticsMetadata?: Record<string, unknown>;
  }
): OnboardingContext {
  const context = createOnboardingContext(entryPoint, options);
  saveOnboardingContext(context);
  return context;
}

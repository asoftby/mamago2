/**
 * Onboarding Orchestrator
 * 
 * Главный координатор всех onboarding flows
 */

import type {
  OnboardingContext,
  OnboardingEntryPoint,
  PostAuthResult,
  DeferredPromptType,
} from "./types";
import { getScenario, getDeferredPrompts } from "./scenarioRegistry";
import {
  initOnboardingContext,
  getOnboardingContext,
  clearOnboardingContext,
} from "./contextManager";
import {
  consumePendingAction,
  clearPendingAction,
  type PendingAction,
} from "./pendingActionManager";
import { trackOnboardingEvent } from "./analytics";

/**
 * Start onboarding flow
 */
export function startOnboarding(
  entryPoint: OnboardingEntryPoint,
  options?: {
    returnUrl?: string;
    analyticsMetadata?: Record<string, unknown>;
  }
): OnboardingContext {
  const context = initOnboardingContext(entryPoint, options);
  
  // Track analytics
  trackOnboardingEvent("onboarding_entry_opened", {
    entryPoint: context.entryPoint,
    intent: context.intent,
    hasPendingAction: !!context.pendingAction,
    ...context.analyticsMetadata,
  });
  
  return context;
}

/**
 * Complete onboarding flow
 */
export async function completeOnboarding(
  userId: string,
  completedSteps: string[] = [],
  skippedSteps: string[] = []
): Promise<PostAuthResult> {
  const context = getOnboardingContext();
  
  if (!context) {
    return {
      status: "error",
      error: "No onboarding context found",
      completedSteps: [],
      skippedSteps: [],
      deferredPrompts: [],
    };
  }
  
  const scenario = getScenario(context.entryPoint);
  const pendingAction = consumePendingAction();
  
  // Build result
  const result: PostAuthResult = {
    status: "success",
    userId,
    completedSteps,
    skippedSteps,
    deferredPrompts: [],
    completedPendingAction: false,
  };
  
  // Execute pending action if exists
  if (pendingAction) {
    try {
      await executePendingAction(pendingAction, userId);
      result.completedPendingAction = true;
      
      trackOnboardingEvent("pending_action_completed", {
        actionType: pendingAction.type,
        entryPoint: context.entryPoint,
      });
    } catch (error) {
      console.error("Failed to execute pending action:", error);
      result.completedPendingAction = false;
    }
  }
  
  // Determine next action and redirect
  const { nextAction, redirectTarget } = determineNextAction(context, result);
  result.nextAction = nextAction;
  result.redirectTarget = redirectTarget;
  
  // Get deferred prompts
  result.deferredPrompts = getDeferredPrompts(scenario, context, result);
  
  // Schedule deferred prompts
  if (result.deferredPrompts.length > 0) {
    scheduleDeferredPrompts(result.deferredPrompts, context);
  }
  
  // Track completion
  trackOnboardingEvent("onboarding_entry_completed", {
    entryPoint: context.entryPoint,
    intent: context.intent,
    outcome: context.outcome,
    completedSteps: completedSteps.length,
    skippedSteps: skippedSteps.length,
    hasPendingAction: !!pendingAction,
    completedPendingAction: result.completedPendingAction,
    deferredPromptsCount: result.deferredPrompts.length,
    ...context.analyticsMetadata,
  });
  
  // Clear context
  clearOnboardingContext();
  
  return result;
}

/**
 * Cancel onboarding flow
 */
export function cancelOnboarding(reason?: string): void {
  const context = getOnboardingContext();
  
  if (context) {
    trackOnboardingEvent("onboarding_abandoned", {
      entryPoint: context.entryPoint,
      intent: context.intent,
      reason,
      ...context.analyticsMetadata,
    });
  }
  
  clearOnboardingContext();
  // Note: We don't clear pending action on cancel - user might retry
}

/**
 * Determine next action after onboarding
 */
function determineNextAction(
  context: OnboardingContext,
  result: PostAuthResult
): {
  nextAction: PostAuthResult["nextAction"];
  redirectTarget?: string;
} {
  const scenario = getScenario(context.entryPoint);
  
  // Get return URL from scenario or context
  let redirectTarget: string | undefined;
  
  if (scenario.completionStrategy.getReturnUrl) {
    redirectTarget = scenario.completionStrategy.getReturnUrl(context);
  } else if (context.returnUrl) {
    redirectTarget = context.returnUrl;
  }
  
  // Determine action type
  if (result.deferredPrompts.length > 0) {
    return {
      nextAction: {
        type: "show_deferred_prompt",
        payload: result.deferredPrompts[0],
      },
      redirectTarget,
    };
  }
  
  if (redirectTarget) {
    return {
      nextAction: {
        type: "redirect",
        payload: redirectTarget,
      },
      redirectTarget,
    };
  }
  
  return {
    nextAction: {
      type: "none",
    },
  };
}

/**
 * Execute pending action
 */
async function executePendingAction(
  action: PendingAction,
  userId: string
): Promise<void> {
  // This is a placeholder - actual implementation will depend on action type
  // Each action type should have its own executor
  
  switch (action.type) {
    case "saveEvent":
      await executeSaveEvent(action.payload, userId);
      break;
    
    case "saveEventWithDate":
      await executeSaveEventWithDate(action.payload, userId);
      break;
    
    case "saveRouteToPlan":
      await executeSaveRouteToPlan(action.payload, userId);
      break;
    
    case "saveRouteToIdeas":
      await executeSaveRouteToIdeas(action.payload, userId);
      break;
    
    case "openPlan":
      // No server action needed, just redirect
      break;
    
    case "birthdayConstructor":
      await executeBirthdayConstructorAction(action.payload, userId);
      break;
    
    case "createReview":
      // Will be implemented with SMS verification
      break;
    
    default:
      console.warn("Unknown pending action type:", action.type);
  }
}

/**
 * Execute save event action
 */
async function executeSaveEvent(
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  const { activityId } = payload;
  
  if (!activityId || typeof activityId !== "string") {
    throw new Error("Invalid activityId");
  }
  
  // Call API to save event to ideas
  const response = await fetch("/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ activityId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to save event");
  }
  
  // Track analytics
  trackOnboardingEvent("pending_action_completed", {
    actionType: "saveEvent",
    activityId,
    savedTo: "ideas",
  });
}

/**
 * Execute save event with date action
 */
async function executeSaveEventWithDate(
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  const { activityId, date, timeSlot } = payload;
  
  if (!activityId || typeof activityId !== "string") {
    throw new Error("Invalid activityId");
  }
  
  if (!date || typeof date !== "string") {
    throw new Error("Invalid date");
  }
  
  // Call API to save event to plan
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      activityId,
      date,
      timeSlot: timeSlot || null,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to save event to plan");
  }
  
  // Track analytics
  trackOnboardingEvent("pending_action_completed", {
    actionType: "saveEventWithDate",
    activityId,
    date,
    timeSlot,
    savedTo: "plan",
  });
}

/**
 * Execute birthday constructor action
 */
async function executeBirthdayConstructorAction(
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Implementation depends on birthday constructor API
  // This is a placeholder
  console.log("Executing birthday constructor action:", payload);
}

/**
 * Execute save route to plan action
 */
async function executeSaveRouteToPlan(
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  const { routeId, routeSlug, date, routeTitle, coverImageUrl } = payload as {
    routeId: string;
    routeSlug: string;
    date: string;
    routeTitle?: string;
    coverImageUrl?: string;
  };
  
  if (!routeId || typeof routeId !== "string") {
    throw new Error("Invalid routeId");
  }
  
  if (!date || typeof date !== "string") {
    throw new Error("Invalid date");
  }
  
  // Call API to save route to plan
  const response = await fetch("/api/plan/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      routeId,
      routeSlug,
      date,
      title: routeTitle,
      coverImageUrl,
    }),
  });
  
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(error.error || error.message || "Failed to save route to plan");
  }
  
  // Track analytics
  trackOnboardingEvent("pending_action_completed", {
    actionType: "saveRouteToPlan",
    routeId,
    date,
    savedTo: "plan",
  });
}

/**
 * Execute save route to ideas action
 */
async function executeSaveRouteToIdeas(
  payload: Record<string, unknown>,
  userId: string
): Promise<void> {
  const { routeId, routeSlug } = payload;
  
  if (!routeId || typeof routeId !== "string") {
    throw new Error("Invalid routeId");
  }
  
  // Call API to save route to ideas
  const response = await fetch("/api/ideas/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      routeId,
      routeSlug,
    }),
  });
  
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(error.error || error.message || "Failed to save route to ideas");
  }
  
  // Track analytics
  trackOnboardingEvent("pending_action_completed", {
    actionType: "saveRouteToIdeas",
    routeId,
    savedTo: "ideas",
  });
}

/**
 * Schedule deferred prompts
 */
function scheduleDeferredPrompts(
  prompts: DeferredPromptType[],
  context: OnboardingContext
): void {
  // Store deferred prompts for later display
  if (typeof window === "undefined") return;
  
  try {
    const existing = window.sessionStorage.getItem("mamaGo_deferred_prompts_v1");
    const existingPrompts = existing ? JSON.parse(existing) : [];
    
    const newPrompts = prompts.map((type) => ({
      type,
      scheduledAt: Date.now(),
      entryPoint: context.entryPoint,
    }));
    
    window.sessionStorage.setItem(
      "mamaGo_deferred_prompts_v1",
      JSON.stringify([...existingPrompts, ...newPrompts])
    );
    
    // Track analytics
    prompts.forEach((type) => {
      trackOnboardingEvent("deferred_prompt_scheduled", {
        promptType: type,
        entryPoint: context.entryPoint,
      });
    });
  } catch (error) {
    console.error("Failed to schedule deferred prompts:", error);
  }
}

/**
 * Get next deferred prompt to show
 */
export function getNextDeferredPrompt(): {
  type: DeferredPromptType;
  entryPoint: OnboardingEntryPoint;
} | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = window.sessionStorage.getItem("mamaGo_deferred_prompts_v1");
    if (!raw) return null;
    
    const prompts = JSON.parse(raw);
    if (!Array.isArray(prompts) || prompts.length === 0) return null;
    
    return prompts[0];
  } catch (error) {
    console.error("Failed to get deferred prompt:", error);
    return null;
  }
}

/**
 * Mark deferred prompt as shown
 */
export function markDeferredPromptShown(type: DeferredPromptType): void {
  if (typeof window === "undefined") return;
  
  try {
    const raw = window.sessionStorage.getItem("mamaGo_deferred_prompts_v1");
    if (!raw) return;
    
    const prompts = JSON.parse(raw);
    const remaining = prompts.filter((p: { type: string }) => p.type !== type);
    
    if (remaining.length > 0) {
      window.sessionStorage.setItem(
        "mamaGo_deferred_prompts_v1",
        JSON.stringify(remaining)
      );
    } else {
      window.sessionStorage.removeItem("mamaGo_deferred_prompts_v1");
    }
  } catch (error) {
    console.error("Failed to mark deferred prompt as shown:", error);
  }
}

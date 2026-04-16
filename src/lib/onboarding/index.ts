/**
 * Onboarding Orchestrator
 * 
 * Единая точка входа для всех onboarding flows
 */

// Types
export * from "./types";

// Scenario Registry
export {
  getScenario,
  getAllScenarios,
  resolveIntent,
  isFieldRequired,
  isFieldDeferred,
  getDeferredPrompts,
} from "./scenarioRegistry";

// Context Manager
export {
  createOnboardingContext,
  saveOnboardingContext,
  getOnboardingContext,
  clearOnboardingContext,
  updateOnboardingContext,
  initOnboardingContext,
} from "./contextManager";

// Pending Action Manager
export {
  setPendingAction,
  getPendingAction,
  consumePendingAction,
  clearPendingAction,
  hasPendingAction,
  updatePendingAction,
  // Typed helpers
  setPendingSaveEvent,
  setPendingSaveEventWithDate,
  setPendingOpenPlan,
  setPendingBirthdayAction,
  setPendingCreateReview,
  setPendingSaveRouteToPlan,
  setPendingSaveRouteToIdeas,
  // Types
  type PendingAction,
  type SaveEventAction,
  type SaveEventWithDateAction,
  type OpenPlanAction,
  type BirthdayConstructorAction,
  type CreateReviewAction,
  type SaveRouteToPlanAction,
  type SaveRouteToIdeasAction,
  // Type guards
  isSaveEventAction,
  isSaveEventWithDateAction,
  isOpenPlanAction,
  isBirthdayConstructorAction,
  isCreateReviewAction,
  isSaveRouteToPlanAction,
  isSaveRouteToIdeasAction,
} from "./pendingActionManager";

// Orchestrator
export {
  startOnboarding,
  completeOnboarding,
  cancelOnboarding,
  getNextDeferredPrompt,
  markDeferredPromptShown,
} from "./orchestrator";

// Analytics
export {
  trackOnboardingEvent,
  getOnboardingEvents,
  clearOnboardingEvents,
  type OnboardingEventType,
} from "./analytics";

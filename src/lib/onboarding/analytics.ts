/**
 * Onboarding Analytics
 * 
 * Tracking для onboarding events
 */

/**
 * Onboarding event types
 */
export type OnboardingEventType =
  | "onboarding_entry_opened"
  | "onboarding_entry_completed"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_step_skipped"
  | "onboarding_abandoned"
  | "pending_action_resumed"
  | "pending_action_completed"
  | "deferred_prompt_scheduled"
  | "deferred_prompt_shown"
  | "deferred_prompt_completed"
  | "deferred_prompt_skipped"
  | "my_plan_preview_viewed"
  | "my_plan_preview_abandoned"
  | "my_plan_preview_cta_clicked"
  | "my_plan_onboarding_started"
  | "my_plan_onboarding_step_completed"
  | "my_plan_onboarding_step_skipped"
  | "my_plan_onboarding_completed"
  | "my_plan_onboarding_abandoned";

/**
 * Track onboarding event
 */
export function trackOnboardingEvent(
  eventType: OnboardingEventType,
  properties?: Record<string, unknown>
): void {
  // Integration with analytics service (Segment, Amplitude, etc.)
  
  if (typeof window === "undefined") return;
  
  try {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Onboarding Analytics]", eventType, properties);
    }
    
    // Send to analytics service
    if (typeof window.analytics !== "undefined") {
      window.analytics.track(eventType, {
        ...properties,
        timestamp: new Date().toISOString(),
        source: "onboarding_orchestrator",
      });
    }
    
    // Fallback: store in sessionStorage for debugging
    const events = getStoredEvents();
    events.push({
      type: eventType,
      properties,
      timestamp: Date.now(),
    });
    
    // Keep only last 50 events
    if (events.length > 50) {
      events.shift();
    }
    
    window.sessionStorage.setItem(
      "mamaGo_onboarding_events_debug",
      JSON.stringify(events)
    );
  } catch (error) {
    console.error("Failed to track onboarding event:", error);
  }
}

/**
 * Get stored events (for debugging)
 */
function getStoredEvents(): Array<{
  type: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}> {
  if (typeof window === "undefined") return [];
  
  try {
    const raw = window.sessionStorage.getItem("mamaGo_onboarding_events_debug");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get all tracked events (for debugging)
 */
export function getOnboardingEvents(): Array<{
  type: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}> {
  return getStoredEvents();
}

/**
 * Clear tracked events
 */
export function clearOnboardingEvents(): void {
  if (typeof window === "undefined") return;
  
  try {
    window.sessionStorage.removeItem("mamaGo_onboarding_events_debug");
  } catch (error) {
    console.error("Failed to clear onboarding events:", error);
  }
}

// Type augmentation for window.analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

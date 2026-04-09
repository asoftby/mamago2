export type PostAuthAnalyticsEvent =
  | "auth_completed"
  | "my_plan_entry_opened"
  | "pending_action_executed"
  | "completion_started"
  | "completion_step_viewed"
  | "completion_step_completed"
  | "completion_additional_child_added"
  | "completion_finished"
  | "completion_abandoned";

export function trackPostAuthEvent(
  event: PostAuthAnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[PostAuth]", event, properties);
    }
    if (typeof window.analytics !== "undefined") {
      window.analytics.track(event, {
        ...properties,
        timestamp: new Date().toISOString(),
        source: "post_auth",
      });
    }
  } catch {
    /* ignore */
  }
}

declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

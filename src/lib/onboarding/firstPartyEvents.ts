"use client";

import { postAnalyticsEvent } from "@/lib/analytics/client";

/**
 * ONB-013 — real first-party onboarding-funnel events (UserEvent), fired
 * alongside the existing `trackPostAuthEvent`/`trackOnboardingEvent` calls
 * (those stay; `window.analytics` being unwired is a separate, pre-existing
 * issue — see src/lib/onboarding/analytics.ts, src/lib/post-auth/analytics.ts).
 *
 * Payloads are IDs/step names/booleans only — never name, DOB, email, phone.
 */

export function trackAuthStarted(mode: "login" | "register") {
  void postAnalyticsEvent({ eventType: "AUTH_STARTED", meta: { targetAction: mode } });
}

export function trackAuthCompletedEvent(mode: "login" | "register") {
  void postAnalyticsEvent({ eventType: "AUTH_COMPLETED", meta: { targetAction: mode } });
}

export function trackFamilyOnboardingStarted() {
  void postAnalyticsEvent({ eventType: "FAMILY_ONBOARDING_STARTED" });
}

export function trackChildContextCompleted() {
  void postAnalyticsEvent({ eventType: "CHILD_CONTEXT_COMPLETED" });
}

export function trackOnboardingCompleted() {
  void postAnalyticsEvent({ eventType: "ONBOARDING_COMPLETED" });
}

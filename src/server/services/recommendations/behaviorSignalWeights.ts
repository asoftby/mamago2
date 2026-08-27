import type { UserEventType } from "@prisma/client";

/**
 * Canonical learning-signal strength for semantic affinities.
 *
 * These are NOT surface ranking weights. They describe how strongly observed
 * user behaviour updates the long-lived preference profile, so Telegram,
 * My Plan, Home and Discovery learn from the same evidence instead of each
 * inventing their own interpretation of SAVE / PLAN_ADD / negative signals.
 */
export const BEHAVIOR_AFFINITY_WEIGHTS: Readonly<Partial<Record<UserEventType, number>>> = {
  PAGE_VIEW: 0.1,
  CARD_VIEW: 0.25,
  DETAIL_OPEN: 0.75,
  SAVE: 2,
  UNSAVE: -1.5,
  PLAN_ADD: 4,
  PLAN_REMOVE: -3,
  CTA_CLICK: 1,
  BOOKING_CREATED: 5,
  BOOKING_CONFIRMED: 6,
  BOOKING_COMPLETED: 8,
  BOOKING_CANCELLED: -5,
  FEEDBACK_LEFT: 1,
};

export function behaviorAffinityDelta(
  eventType: UserEventType,
  meta?: Record<string, unknown> | null,
): number {
  if (eventType !== "FEEDBACK_LEFT") {
    return BEHAVIOR_AFFINITY_WEIGHTS[eventType] ?? 0;
  }

  const sentiment = typeof meta?.sentiment === "string" ? meta.sentiment.toLowerCase() : "";
  if (["positive", "up", "like", "good"].includes(sentiment)) return 5;
  if (["negative", "down", "dislike", "bad"].includes(sentiment)) return -5;
  return BEHAVIOR_AFFINITY_WEIGHTS.FEEDBACK_LEFT ?? 1;
}

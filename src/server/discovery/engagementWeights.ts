import type { UserEventType } from "@prisma/client";

/**
 * Canonical engagement ranking weights — the single source of truth for how
 * strongly each UserEvent type counts toward content ranking (Kuda discovery
 * feed, My Plan suggestions). PLAN_ADD outranks SAVE: committing an item to a
 * concrete day is a stronger intent signal than bookmarking it.
 */
export const ENGAGEMENT_WEIGHTS: Partial<Record<UserEventType, number>> = {
  CARD_VIEW: 1,
  DETAIL_OPEN: 2,
  PAGE_VIEW: 2,
  CTA_CLICK: 3,
  SAVE: 4,
  PLAN_ADD: 5,
};

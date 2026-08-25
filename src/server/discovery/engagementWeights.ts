import type { UserEventType } from "@prisma/client";

/**
 * Canonical engagement ranking weights — the single source of truth for how
 * strongly each entity-scoped UserEvent type counts toward content ranking
 * (Kuda discovery feed, My Plan suggestions). PLAN_ADD outranks SAVE:
 * committing an item to a concrete day is a stronger intent signal than
 * bookmarking it.
 *
 * Contract v1: PAGE_VIEW is traffic telemetry and never a content-engagement
 * signal. Only entity-scoped content interactions belong here.
 */
export const ENGAGEMENT_WEIGHTS: Partial<Record<UserEventType, number>> = {
  CARD_VIEW: 1,
  DETAIL_OPEN: 2,
  CTA_CLICK: 3,
  SAVE: 4,
  PLAN_ADD: 5,
};

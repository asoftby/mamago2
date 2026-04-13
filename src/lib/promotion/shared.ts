import {
  AnalyticsEntityType,
  PromotionActionType,
  PromotionPublicationType,
  type UserEventType,
} from "@prisma/client";
import { buildBusinessPath } from "../routing/surface.ts";

export const PROMOTION_MIN_BUDGET = 20;
export const PROMOTION_MAX_BUDGET = 1000;

export const PROMOTION_ACTION_COSTS: Record<PromotionActionType, number> = {
  SAVE_TO_PLAN: 1,
  SEND_LEAD: 5,
};

export function getPromotionPublicationLabel(type: PromotionPublicationType): string {
  return type === "EVENT" ? "Event" : "Offer";
}

export function getPromotionActionLabel(type: PromotionActionType): string {
  return type === "SAVE_TO_PLAN" ? "Сохранение в план" : "Лид / обращение";
}

export function mapAnalyticsEntityToPromotionPublicationType(
  entityType: AnalyticsEntityType | null | undefined,
): PromotionPublicationType | null {
  if (entityType === "EVENT") return PromotionPublicationType.EVENT;
  if (entityType === "OFFER") return PromotionPublicationType.OFFER;
  return null;
}

type PromotionTelemetryMeta = {
  targetAction?: string;
};

/**
 * MVP attribution:
 * - PLAN_ADD counts as a strong “save to plan” intent.
 * - CTA_CLICK counts as a lead-like action only when it is not the plan/ideas CTA.
 */
export function mapUserEventToPromotionAction(params: {
  eventType: UserEventType;
  meta?: PromotionTelemetryMeta | null;
}): PromotionActionType | null {
  if (params.eventType === "PLAN_ADD") {
    return PromotionActionType.SAVE_TO_PLAN;
  }

  if (params.eventType !== "CTA_CLICK") {
    return null;
  }

  const targetAction = params.meta?.targetAction?.trim().toLowerCase();

  if (!targetAction) {
    return PromotionActionType.SEND_LEAD;
  }

  if (targetAction === "plan" || targetAction === "ideas") {
    return null;
  }

  return PromotionActionType.SEND_LEAD;
}

export function buildPromotionLaunchHref(params?: {
  publicationType?: PromotionPublicationType | "EVENT" | "OFFER";
  publicationId?: string;
}) {
  if (!params?.publicationType || !params.publicationId) {
    return buildBusinessPath("/promotion");
  }

  const search = new URLSearchParams({
    publicationType: params.publicationType,
    publicationId: params.publicationId,
  });

  return `${buildBusinessPath("/promotion")}?${search.toString()}`;
}

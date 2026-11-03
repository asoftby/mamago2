import "server-only";
import type { PlanVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addPlanItem } from "@/server/services/plan.service";
import { familyIdForWrite, familyReadsEnabled } from "@/server/family/familyAccess";
import { trackUserEvent, trackFirstOccurrenceEvent } from "@/server/services/analytics/AnalyticsEventService";
import type { AnalyticsMetaPayload } from "@/lib/analytics/types";

export type HomePlanWrite = {
  userId: string; activityId: string; date: string; startsAt?: Date;
  title?: string; coverImageUrl?: string; visibility?: PlanVisibility;
};
/** Reuse the plan writer and family ACL. Serialize Home retries in the same ACL scope. */
export async function addHomeEventPlanItem(input: HomePlanWrite) {
  const familyId = await familyIdForWrite(input.userId);
  const key = `home-plan:${familyReadsEnabled() ? familyId : input.userId}:${input.activityId}`;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    return addPlanItem(input.userId, input.activityId, input.date, input.startsAt,
      input.title, input.coverImageUrl, input.visibility, tx);
  });
}

const defaults = { track: trackUserEvent, first: trackFirstOccurrenceEvent };
/** Called only for a committed, newly created PlanItem, never for a client click. */
export async function recordHomePlanAdd(input: {
  userId: string; activityId: string; planItemId: string; exposureId: string | null;
  sessionId: string | null; cityId: string | null; visibility?: PlanVisibility;
  dateMeta: AnalyticsMetaPayload; subjectsMeta: AnalyticsMetaPayload;
}, deps = defaults) {
  const result = await deps.track({
    userId: input.userId, sessionId: input.sessionId, eventType: "PLAN_ADD",
    entityType: "EVENT", entityId: input.activityId, vertical: "CITY", cityId: input.cityId,
    planVisibility: input.visibility, idempotencyKey: `home-plan-add:${input.planItemId}`,
    attributionPolicy: "HOME_PLAN_ADD",
    meta: { ...input.dateMeta, ...input.subjectsMeta, source: "recommendation", section: "home",
      targetAction: "plan", planAddSource: "home-family-picks", planItemId: input.planItemId,
      ...(input.exposureId ? { recommendationExposureId: input.exposureId } : {}) },
  });
  if (!result.ok) {
    // The product write is already committed. No durable outbox exists; do not fabricate success.
    console.error("[family-home] committed plan has no confirmed telemetry", { planItemId: input.planItemId, reason: result.error });
    return "unavailable" as const;
  }
  if (!result.recommendationOutcomeLinked) return "unattributed" as const;
  await deps.first({ userId: input.userId, sessionId: input.sessionId,
    eventType: "FIRST_PERSONALIZED_PLAN_ADD", meta: { recommendationSurface: "home" } });
  return "recorded" as const;
}

/** The route and PostgreSQL tests share this committed-write/created-only boundary. */
export async function saveHomeEventPlan(input: HomePlanWrite & {
  exposureId: string | null; sessionId: string | null; cityId: string | null;
  dateMeta: AnalyticsMetaPayload; subjectsMeta: AnalyticsMetaPayload;
}) {
  const planItem = await addHomeEventPlanItem(input);
  const attributionStatus = planItem.created
    ? await recordHomePlanAdd({ ...input, planItemId: planItem.id })
    : "existing" as const;
  return { planItem, attributionStatus };
}

import type {
  AnalyticsEntityType,
  Prisma,
  RecommendationSurface,
  UserEventType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RecommendationTraceItem = {
  entityType: AnalyticsEntityType;
  entityId: string;
  position: number;
  score?: number | null;
  scoreBreakdown?: Prisma.InputJsonValue | null;
  reasonCodes?: string[];
};

export type RecommendationRunTraceInput = {
  userId?: string | null;
  sessionId?: string | null;
  /** Guest product identity (client-generated UUID) when userId is absent. */
  anonymousId?: string | null;
  surface: RecommendationSurface;
  cityId?: string | null;
  citySlug?: string | null;
  targetDateFrom?: string | null;
  targetDateTo?: string | null;
  algorithmVersion: string;
  /** Surface policy actually applied by the caller, not merely the latest policy. */
  policyId?: string | null;
  policyVersion?: number | null;
  context?: Prisma.InputJsonValue | null;
  candidateCount: number;
  items: RecommendationTraceItem[];
};

export type RecommendationRunTraceResult = {
  runId: string;
  exposureIdByEntityKey: Map<string, string>;
};

function entityKey(entityType: AnalyticsEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/**
 * Persist the recommendation result that a surface received.
 *
 * This service is intentionally ranking-agnostic: it records what an existing
 * engine selected and why. A tracing failure must never make the product flow
 * fail, so callers receive `null` and continue serving recommendations.
 */
export async function recordRecommendationRun(
  input: RecommendationRunTraceInput,
): Promise<RecommendationRunTraceResult | null> {
  try {
    const items = input.items
      .filter((item) => item.entityId.trim().length > 0 && item.position > 0)
      .sort((a, b) => a.position - b.position);

    const run = await prisma.recommendationRun.create({
      data: {
        userId: input.userId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        anonymousId: input.anonymousId ?? undefined,
        surface: input.surface,
        cityId: input.cityId ?? undefined,
        citySlug: input.citySlug ?? undefined,
        targetDateFrom: input.targetDateFrom ?? undefined,
        targetDateTo: input.targetDateTo ?? undefined,
        algorithmVersion: input.algorithmVersion,
        policyId: input.policyId ?? undefined,
        policyVersion: input.policyVersion ?? undefined,
        context: input.context ?? undefined,
        candidateCount: Math.max(0, input.candidateCount),
        selectedCount: items.length,
        exposures: {
          create: items.map((item) => ({
            entityType: item.entityType,
            entityId: item.entityId,
            position: item.position,
            score: item.score ?? undefined,
            scoreBreakdown: item.scoreBreakdown ?? undefined,
            reasonCodes: item.reasonCodes ?? [],
          })),
        },
      },
      select: {
        id: true,
        exposures: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
          },
        },
      },
    });

    return {
      runId: run.id,
      exposureIdByEntityKey: new Map(
        run.exposures.map((exposure) => [
          entityKey(exposure.entityType, exposure.entityId),
          exposure.id,
        ]),
      ),
    };
  } catch (error) {
    console.error("[recommendation-trace] record run failed", error);
    return null;
  }
}

export type RecentRecommendationAttributionInput = {
  userId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
  surface?: RecommendationSurface;
  maxAgeMinutes?: number;
};

/**
 * Server-side attribution fallback for actions whose existing client contract
 * predates recommendation IDs. Explicit exposure IDs remain preferable, but a
 * short recent window lets old call sites participate without duplicating UI
 * state or recommendation logic.
 */
export async function findRecentRecommendationAttribution(
  input: RecentRecommendationAttributionInput,
): Promise<{ exposureId: string; runId: string } | null> {
  try {
    const maxAgeMinutes = Math.min(24 * 60, Math.max(1, input.maxAgeMinutes ?? 120));
    const since = new Date(Date.now() - maxAgeMinutes * 60_000);
    const exposure = await prisma.recommendationExposure.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        exposedAt: { gte: since },
        run: {
          userId: input.userId,
          ...(input.surface ? { surface: input.surface } : {}),
        },
      },
      orderBy: { exposedAt: "desc" },
      select: { id: true, runId: true },
    });
    return exposure ? { exposureId: exposure.id, runId: exposure.runId } : null;
  } catch (error) {
    console.error("[recommendation-trace] recent attribution lookup failed", error);
    return null;
  }
}

export type RecommendationAttributionVerifyInput = {
  exposureId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
  userId?: string | null;
  sessionId?: string | null;
  anonymousId?: string | null;
};

/**
 * Verifies a CLIENT-SUPPLIED (explicit) exposure id before trusting it for
 * anything — decisionId, RecommendationOutcome, etc. Trust requires both:
 * (1) the exposure's entityType/entityId actually match the entity this
 * action is about, and (2) the exposure's run belongs to the same actor
 * (user, session, or guest anonymousId). Never trust an unverified id.
 */
export async function verifyRecommendationAttribution(
  input: RecommendationAttributionVerifyInput,
): Promise<{ exposureId: string; runId: string } | null> {
  try {
    if (!input.exposureId) return null;

    const ownershipOr: Prisma.RecommendationRunWhereInput[] = [];
    if (input.userId) ownershipOr.push({ userId: input.userId });
    if (input.sessionId) ownershipOr.push({ sessionId: input.sessionId });
    if (input.anonymousId) ownershipOr.push({ anonymousId: input.anonymousId });
    if (ownershipOr.length === 0) return null;

    const exposure = await prisma.recommendationExposure.findFirst({
      where: {
        id: input.exposureId,
        entityType: input.entityType,
        entityId: input.entityId,
        run: { OR: ownershipOr },
      },
      select: { id: true, runId: true },
    });
    return exposure ? { exposureId: exposure.id, runId: exposure.runId } : null;
  } catch (error) {
    console.error("[recommendation-trace] attribution verification failed", error);
    return null;
  }
}

export type RecommendationOutcomeLinkInput = {
  exposureId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
  userEventId: string;
  eventType: UserEventType;
  userId?: string | null;
  sessionId?: string | null;
  anonymousId?: string | null;
};

/**
 * Attribute an existing first-party UserEvent to a recommendation exposure.
 * Delegates to verifyRecommendationAttribution so a client-supplied exposure
 * id can never link an event to another actor's (or another entity's)
 * recommendation history.
 */
export async function linkRecommendationOutcome(
  input: RecommendationOutcomeLinkInput,
): Promise<boolean> {
  try {
    if (!input.exposureId || !input.userEventId) return false;

    const verified = await verifyRecommendationAttribution(input);
    if (!verified) return false;

    await prisma.recommendationOutcome.upsert({
      where: { userEventId: input.userEventId },
      create: {
        exposureId: verified.exposureId,
        userEventId: input.userEventId,
        eventType: input.eventType,
      },
      update: {
        exposureId: verified.exposureId,
        eventType: input.eventType,
      },
    });
    return true;
  } catch (error) {
    console.error("[recommendation-trace] link outcome failed", error);
    return false;
  }
}

export async function getPublishedRecommendationSurfacePolicy(
  surface: RecommendationSurface,
) {
  return prisma.recommendationSurfacePolicy.findFirst({
    where: { surface, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
}

export const RecommendationTraceService = {
  recordRecommendationRun,
  findRecentRecommendationAttribution,
  verifyRecommendationAttribution,
  linkRecommendationOutcome,
  getPublishedRecommendationSurfacePolicy,
};

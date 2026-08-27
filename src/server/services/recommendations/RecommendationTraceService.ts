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

export type RecommendationOutcomeLinkInput = {
  exposureId: string;
  userEventId: string;
  eventType: UserEventType;
  userId?: string | null;
  sessionId?: string | null;
};

/**
 * Attribute an existing first-party UserEvent to a recommendation exposure.
 * The ownership check prevents a client-supplied exposure id from linking an
 * event to another user's recommendation history.
 */
export async function linkRecommendationOutcome(
  input: RecommendationOutcomeLinkInput,
): Promise<boolean> {
  try {
    if (!input.exposureId || !input.userEventId) return false;

    const ownershipOr: Prisma.RecommendationRunWhereInput[] = [];
    if (input.userId) ownershipOr.push({ userId: input.userId });
    if (input.sessionId) ownershipOr.push({ sessionId: input.sessionId });
    if (ownershipOr.length === 0) return false;

    const exposure = await prisma.recommendationExposure.findFirst({
      where: {
        id: input.exposureId,
        run: { OR: ownershipOr },
      },
      select: { id: true },
    });
    if (!exposure) return false;

    await prisma.recommendationOutcome.upsert({
      where: { userEventId: input.userEventId },
      create: {
        exposureId: exposure.id,
        userEventId: input.userEventId,
        eventType: input.eventType,
      },
      update: {
        exposureId: exposure.id,
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
  linkRecommendationOutcome,
  getPublishedRecommendationSurfacePolicy,
};

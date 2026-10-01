/**
 * Запись first-party продуктовой телеметрии в БД (UserEvent → при наличии userId ещё UserBehaviorProfile).
 * Не путать с внешней веб-аналитикой: согласие «Внешняя веб-аналитика» в cookie-баннере относится к GA/PostHog и т.п.,
 * а не к этому сервису. См. docs/cookies-and-telemetry.md.
 *
 * Папка `server/services/analytics` содержит и админские отчёты по UserEvent — имя историческое.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import type { TrackUserEventInput, TrackUserEventResult } from "@/lib/analytics/types";
import { applyUserBehaviorEvent } from "@/server/services/analytics/UserBehaviorAggregationService";
import { enrichSemanticEventMeta } from "@/server/services/analytics/SemanticEventContextService";
import { registerPromotionActionFromUserEvent } from "@/server/services/promotion/promotion.service";
import {
  findRecentRecommendationAttribution,
  verifyRecommendationAttribution,
  linkRecommendationOutcome,
} from "@/server/services/recommendations/RecommendationTraceService";

async function resolveCityId(
  cityId?: string | null,
  citySlug?: string | null,
): Promise<string | null> {
  if (cityId) return cityId;
  if (!citySlug?.trim()) return null;
  const row = await findCityBySlug(citySlug.trim(), { select: { id: true } });
  return row?.id ?? null;
}

function metaRecord(meta: Prisma.InputJsonValue | undefined): Record<string, unknown> | null {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : null;
}

/**
 * Универсальная запись события продуктовой телеметрии. Не бросает наружу ошибки БД.
 */
export async function trackUserEvent(
  input: TrackUserEventInput,
): Promise<TrackUserEventResult> {
  try {
    const cityId = await resolveCityId(input.cityId ?? null, input.citySlug ?? null);

    let meta: Prisma.InputJsonValue | undefined =
      input.meta != null && typeof input.meta === "object"
        ? (input.meta as Prisma.InputJsonValue)
        : undefined;

    // Preserve semantic facts at event time. This is intentionally before the
    // behavior-profile projection so both raw history and the projection learn
    // from the same immutable context. Planning timing is supplied by the
    // plan-write path directly because that date is already known there.
    meta = await enrichSemanticEventMeta({
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      eventType: input.eventType,
      meta,
    });
    let metaObject = metaRecord(meta);

    // Existing recommendation call sites may not yet carry exposure IDs through
    // every action contract. Attribute a short-lived action to the user's most
    // recent matching exposure instead of forcing duplicate UI state into each
    // feature. A CLIENT-SUPPLIED exposure id is never trusted as-is — it is
    // always re-verified server-side (entity match + actor ownership) before
    // anything is built on top of it, exactly like the fallback lookup already
    // does implicitly via its own scoped query. See decisionId below.
    const isRecommendationAction = metaObject?.source === "recommendation";
    const explicitExposureId =
      typeof metaObject?.recommendationExposureId === "string"
        ? metaObject.recommendationExposureId.trim()
        : "";

    let attribution: { exposureId: string; runId: string } | null = null;
    if (isRecommendationAction && input.entityType && input.entityId) {
      if (explicitExposureId) {
        attribution = await verifyRecommendationAttribution({
          exposureId: explicitExposureId,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          anonymousId: input.anonymousId ?? null,
        });
      } else if (input.userId || input.anonymousId) {
        // Also matches a guest-owned run (anonymousId) even once the actor
        // is now authenticated — old guest history keeps its own identity,
        // we just look it up by both keys instead of rewriting it.
        attribution = await findRecentRecommendationAttribution({
          userId: input.userId ?? null,
          anonymousId: input.anonymousId ?? null,
          entityType: input.entityType,
          entityId: input.entityId,
          maxAgeMinutes: 120,
        });
      }

      if (attribution) {
        metaObject = {
          ...(metaObject ?? {}),
          recommendationExposureId: attribution.exposureId,
          recommendationRunId: attribution.runId,
        };
        meta = metaObject as Prisma.InputJsonValue;
      } else if (explicitExposureId) {
        // Unverified client-supplied id: strip it rather than persist an
        // unproven attribution claim anywhere (meta, decisionId, or the
        // later linkRecommendationOutcome call below).
        const { recommendationExposureId: _drop1, recommendationRunId: _drop2, ...rest } =
          metaObject ?? {};
        metaObject = rest;
        meta = metaObject as Prisma.InputJsonValue;
      }
    }

    // decisionId = RecommendationRun.id, set ONLY from a verified attribution
    // above (explicit-and-verified, or the ownership-scoped fallback). Not a
    // hard FK — see UserEvent.decisionId.
    const decisionId = attribution?.runId;

    let userEvent;
    try {
      userEvent = await prisma.userEvent.create({
        data: {
          idempotencyKey: input.idempotencyKey ?? undefined,
          userId: input.userId ?? undefined,
          sessionId: input.sessionId ?? undefined,
          anonymousId: input.anonymousId ?? undefined,
          decisionId,
          eventType: input.eventType,
          entityType: input.entityType ?? undefined,
          entityId: input.entityId ?? undefined,
          vertical: input.vertical ?? undefined,
          cityId: cityId ?? undefined,
          meta: meta === undefined ? undefined : meta,
        },
      });
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // The winning request already owns every downstream side effect. Do
        // not aggregate behavior, register promotion actions, or link another
        // recommendation outcome for this retry.
        return { ok: true };
      }
      throw error;
    }

    if (input.userId) {
      void applyUserBehaviorEvent({
        userId: input.userId,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        vertical: input.vertical ?? null,
        meta: meta === undefined ? null : (meta as Prisma.JsonValue),
      });
    }

    void registerPromotionActionFromUserEvent({
      userEventId: userEvent.id,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta: metaObject,
    });

    const recommendationExposureId =
      typeof metaObject?.recommendationExposureId === "string"
        ? metaObject.recommendationExposureId.trim()
        : "";
    if (recommendationExposureId && input.entityType && input.entityId) {
      void linkRecommendationOutcome({
        exposureId: recommendationExposureId,
        entityType: input.entityType,
        entityId: input.entityId,
        userEventId: userEvent.id,
        eventType: input.eventType,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        anonymousId: input.anonymousId ?? null,
      });
    }

    return { ok: true };
  } catch (error) {
    console.error("[product-telemetry] trackUserEvent failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * Fires `input.eventType` only if the user has never had one before
 * (ONB-013 FIRST_PERSONALIZED_* milestones). Best-effort like `trackUserEvent`
 * itself — a race between two concurrent requests can occasionally record the
 * milestone twice, which is acceptable for funnel analytics.
 */
export async function trackFirstOccurrenceEvent(
  input: TrackUserEventInput & { userId: string },
): Promise<void> {
  try {
    const existing = await prisma.userEvent.findFirst({
      where: { userId: input.userId, eventType: input.eventType },
      select: { id: true },
    });
    if (existing) return;
    await trackUserEvent(input);
  } catch (error) {
    console.error("[product-telemetry] trackFirstOccurrenceEvent failed:", error);
  }
}

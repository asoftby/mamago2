/**
 * Запись first-party продуктовой телеметрии в БД (UserEvent → при наличии userId ещё UserBehaviorProfile).
 * Не путать с внешней веб-аналитикой: согласие «Внешняя веб-аналитика» в cookie-баннере относится к GA/PostHog и т.п.,
 * а не к этому сервису. См. docs/cookies-and-telemetry.md.
 *
 * Папка `server/services/analytics` содержит и админские отчёты по UserEvent — имя историческое.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import type { TrackUserEventInput, TrackUserEventResult } from "@/lib/analytics/types";
import { applyUserBehaviorEvent } from "@/server/services/analytics/UserBehaviorAggregationService";
import { enrichSemanticEventMeta } from "@/server/services/analytics/SemanticEventContextService";
import { registerPromotionActionFromUserEvent } from "@/server/services/promotion/promotion.service";
import {
  findRecentRecommendationAttribution,
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
    // from the same immutable context.
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
    // feature. Explicit IDs always win.
    const isRecommendationAction = metaObject?.source === "recommendation";
    const hasExplicitExposure =
      typeof metaObject?.recommendationExposureId === "string" &&
      metaObject.recommendationExposureId.trim().length > 0;
    if (
      isRecommendationAction &&
      !hasExplicitExposure &&
      input.userId &&
      input.entityType &&
      input.entityId
    ) {
      const attribution = await findRecentRecommendationAttribution({
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        maxAgeMinutes: 120,
      });
      if (attribution) {
        metaObject = {
          ...(metaObject ?? {}),
          recommendationExposureId: attribution.exposureId,
          recommendationRunId: attribution.runId,
        };
        meta = metaObject as Prisma.InputJsonValue;
      }
    }

    const userEvent = await prisma.userEvent.create({
      data: {
        userId: input.userId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        eventType: input.eventType,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        vertical: input.vertical ?? undefined,
        cityId: cityId ?? undefined,
        meta: meta === undefined ? undefined : meta,
      },
    });

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
    if (recommendationExposureId) {
      void linkRecommendationOutcome({
        exposureId: recommendationExposureId,
        userEventId: userEvent.id,
        eventType: input.eventType,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
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

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
import { registerPromotionActionFromUserEvent } from "@/server/services/promotion/promotion.service";

async function resolveCityId(
  cityId?: string | null,
  citySlug?: string | null,
): Promise<string | null> {
  if (cityId) return cityId;
  if (!citySlug?.trim()) return null;
  const row = await findCityBySlug(citySlug.trim(), { select: { id: true } });
  return row?.id ?? null;
}

/**
 * Универсальная запись события продуктовой телеметрии. Не бросает наружу ошибки БД.
 *
 * For authenticated users the derived behavior profile is awaited after the
 * authoritative UserEvent insert. This avoids losing profile updates when a
 * request/process finishes before a fire-and-forget promise is flushed.
 */
export async function trackUserEvent(
  input: TrackUserEventInput,
): Promise<TrackUserEventResult> {
  try {
    const cityId = await resolveCityId(input.cityId ?? null, input.citySlug ?? null);

    const meta: Prisma.InputJsonValue | undefined =
      input.meta != null && typeof input.meta === "object"
        ? (input.meta as Prisma.InputJsonValue)
        : undefined;

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
      await applyUserBehaviorEvent({
        userId: input.userId,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        vertical: input.vertical ?? null,
        meta: meta === undefined ? null : (meta as Prisma.JsonValue),
        createdAt: userEvent.createdAt,
      });
    }

    // Legacy paid Promotion is disabled in first PROD; keep the adapter
    // non-blocking because UserEvent/domain state is the source of truth.
    void registerPromotionActionFromUserEvent({
      userEventId: userEvent.id,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta:
        meta && typeof meta === "object" && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : null,
    });

    return { ok: true };
  } catch (e) {
    console.error("[product-telemetry] trackUserEvent failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown_error",
    };
  }
}

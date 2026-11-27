import prisma from "@/lib/prisma";
import { ActivityType, PromotionPublicationType, PromotionStatus, PublicationType } from "@prisma/client";
import {
  businessEventListViewWhere,
  excludeGhostEventDrafts,
  type BusinessEventListView,
} from "@/lib/business/eventListWhere";
import { getEventTemporalState, type EventTemporalState } from "@/lib/events/eventTemporalState";
import { businessPublicationDayRange } from "@/lib/business/publicationAnalyticsRange";
import { getPerformanceMetricsByEntity } from "@/server/services/business/businessWorkspace.service";
import { getPromotionPerformanceByActivityIds } from "@/server/services/promotion/boostPerformance.service";
import {
  getFreeBoostDialogState,
  type FreeBoostCandidate,
} from "@/server/services/promotion/dailyFreeBoost.service";

/**
 * Единый серверный источник данных списка событий бизнес-кабинета.
 * Его используют ОБА маршрута (`/business/events` и
 * `/business/publications/events`), чтобы дата, статус по расписанию и
 * доступность Boost не расходились между страницами.
 */

export type EventSessionInfo = {
  lastSessionStart: Date | null;
  nextSessionStart: Date | null;
};

/** Дата на карточке: ближайший будущий сеанс → последний прошедший → nextOccurrenceAt. */
export function resolveDisplayOccurrenceAt(
  sessions: EventSessionInfo,
  nextOccurrenceAt: Date | null,
): Date | null {
  return sessions.nextSessionStart ?? sessions.lastSessionStart ?? nextOccurrenceAt;
}

/** Состояние по расписанию строится по последнему неотозванному сеансу. */
export function resolveEventTemporalState(params: {
  scheduleMode: Parameters<typeof getEventTemporalState>[0]["scheduleMode"];
  nextOccurrenceAt: Date | null;
  sessions: EventSessionInfo;
  now: Date;
}): EventTemporalState {
  return getEventTemporalState({
    scheduleMode: params.scheduleMode,
    nextOccurrenceAt: params.nextOccurrenceAt,
    sessions: params.sessions.lastSessionStart
      ? [{ startsAt: params.sessions.lastSessionStart }]
      : [],
    now: params.now,
  });
}

/** Boost блокируется на сервере: нет квоты, публикация не подходит или уже продвигается. */
export function resolveBoostState(params: {
  availableToday: boolean;
  candidate: FreeBoostCandidate | undefined;
}): { boostDisabled: boolean; boostNextFreeAt: string | null } {
  const { availableToday, candidate } = params;
  return {
    boostDisabled:
      !availableToday || !candidate?.eligible || Boolean(candidate.activeBoostUntil),
    boostNextFreeAt: candidate?.activeFreeBoostUntil ?? null,
  };
}

export async function getBusinessEventsList(params: {
  userId: string;
  businessId: string;
  view: BusinessEventListView;
  /** Один момент времени на всю выборку (и для тестов). */
  now?: Date;
}) {
  const { userId, businessId, view } = params;
  const now = params.now ?? new Date();

  const activities = await prisma.activity.findMany({
    where: {
      OR: [{ ownerUserId: userId }, { businessId }],
      type: ActivityType.EVENT,
      ...businessEventListViewWhere(view),
      ...excludeGhostEventDrafts(),
    },
    include: {
      coverImage: { select: { publicUrl: true } },
      place: {
        select: {
          id: true,
          title: true,
          city: { select: { slug: true } },
        },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const activityIds = activities.map((activity) => activity.id);
  // Authored events may belong to another business; never expose that
  // business's bookings in the current tenant's event actions.
  const ownedActivityIds = activities.filter((activity) => activity.businessId === businessId)
    .map((activity) => activity.id);
  const sessionWhere = { activityId: { in: activityIds }, withdrawnAt: null };

  const [
    metricsByEntity,
    activePromotions,
    promotionPerformanceByActivity,
    lastSessions,
    upcomingSessions,
    freeBoost,
    bookingHistory,
  ] = await Promise.all([
    getPerformanceMetricsByEntity({
      events: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        updatedAt: activity.createdAt,
        status: activity.status,
      })),
      offers: [],
      dateRange: businessPublicationDayRange("today", now),
    }),
    activityIds.length === 0
      ? Promise.resolve([])
      : prisma.promotion.findMany({
          where: {
            businessId,
            publicationType: PromotionPublicationType.EVENT,
            publicationId: { in: activityIds },
            status: PromotionStatus.ACTIVE,
          },
          select: { publicationId: true },
        }),
    getPromotionPerformanceByActivityIds(activityIds, now),
    // Одна агрегация на все события, строк не больше числа событий.
    activityIds.length === 0
      ? Promise.resolve([])
      : prisma.activitySession.groupBy({
          by: ["activityId"],
          where: sessionWhere,
          _max: { startsAt: true },
        }),
    activityIds.length === 0
      ? Promise.resolve([])
      : prisma.activitySession.groupBy({
          by: ["activityId"],
          where: { ...sessionWhere, startsAt: { gte: now } },
          _min: { startsAt: true },
        }),
    getFreeBoostDialogState({ businessId, userId, now }),
    // Historical eligibility includes rejected, cancelled and elapsed requests.
    // One grouped query serves the entire list, never one query per event.
    ownedActivityIds.length === 0
      ? Promise.resolve([])
      : prisma.bookingRequest.groupBy({
          by: ["activityId"],
          where: {
            businessId,
            publicationType: PublicationType.EVENT,
            activityId: { in: ownedActivityIds },
          },
          _count: { _all: true },
        }),
  ]);

  const lastSessionStartByActivity = new Map(
    lastSessions.flatMap((row) =>
      row._max.startsAt ? [[row.activityId, row._max.startsAt] as const] : [],
    ),
  );
  const nextSessionStartByActivity = new Map(
    upcomingSessions.flatMap((row) =>
      row._min.startsAt ? [[row.activityId, row._min.startsAt] as const] : [],
    ),
  );
  const activityIdsWithBookingHistory = new Set(
    bookingHistory.filter((row) => row.activityId !== null && row._count._all > 0)
      .map((row) => row.activityId),
  );
  const activePromotionIds = new Set(activePromotions.map((promotion) => promotion.publicationId));
  const boostCandidates = new Map(
    freeBoost.candidates
      .filter((candidate) => candidate.publicationType === "EVENT")
      .map((candidate) => [candidate.id, candidate]),
  );

  return activities
    .map((activity) => {
      const promotionPerformance = promotionPerformanceByActivity.get(activity.id) ?? null;
      const sessions: EventSessionInfo = {
        lastSessionStart: lastSessionStartByActivity.get(activity.id) ?? null,
        nextSessionStart: nextSessionStartByActivity.get(activity.id) ?? null,
      };
      return {
        ...activity,
        displayOccurrenceAt: resolveDisplayOccurrenceAt(sessions, activity.nextOccurrenceAt),
        temporalState: resolveEventTemporalState({
          scheduleMode: activity.scheduleMode,
          nextOccurrenceAt: activity.nextOccurrenceAt,
          sessions,
          now,
        }),
        isPromoted:
          activePromotionIds.has(activity.id) || promotionPerformance?.isPromoted === true,
        ...resolveBoostState({
          availableToday: freeBoost.availableToday,
          candidate: boostCandidates.get(activity.id),
        }),
        promotionPerformance,
        hasBookingHistory: activityIdsWithBookingHistory.has(activity.id),
        metrics: {
          ...(metricsByEntity.get(`EVENT:${activity.id}`) ?? {
            views: 0,
            saves: 0,
            planAdds: 0,
            ctaClicks: 0,
          }),
        },
      };
    })
    .sort((a, b) => Number(b.isPromoted) - Number(a.isPromoted));
}

export type BusinessEventListItem = Awaited<ReturnType<typeof getBusinessEventsList>>[number];

import type { Prisma } from "@prisma/client";
import { ContentStatus, ScheduleMode } from "@prisma/client";
import {
  activityOwnerBusinessActiveWhere,
  placeOwnerBusinessActiveWhere,
} from "@/server/business/businessOperationalPrisma";

export { activityOwnerBusinessActiveWhere, placeOwnerBusinessActiveWhere };

/**
 * Публичная выдача событий: «живые» карточки = не черновик, не первичная модерация, не правки/отклонено/удалено.
 * Используем `notIn`, а не `in: [PUBLISHED, PENDING_UPDATE]`: иначе часть рантаймов Prisma/Turbopack
 * валидирует массив `in` против устаревшего списка enum и падает на PENDING_UPDATE даже при актуальной БД.
 */
function publicListingActivityStatusWhere(): Prisma.ActivityWhereInput {
  return {
    status: {
      notIn: [
        ContentStatus.DRAFT,
        ContentStatus.PENDING,
        ContentStatus.NEEDS_REVISION,
        ContentStatus.REJECTED,
        ContentStatus.DELETED,
      ],
    },
  };
}

/**
 * Публичная видимость места: PUBLISHED + не архив + владелец без отключённого бизнеса.
 * Не меняет статусы сущностей — только правило выборки.
 */
export function getPublicPublishedPlaceWhere(
  now: Date = new Date()
): Prisma.PlaceWhereInput {
  void now;
  return {
    AND: [
      { status: "PUBLISHED" },
      { archivedAt: null },
      placeOwnerBusinessActiveWhere,
    ],
  };
}

/**
 * Событие не истекло для публичной выдачи (доп. к PUBLISHED и активному бизнесу).
 */
export function getActivityNotExpiredForPublicWhere(
  now: Date = new Date()
): Prisma.ActivityWhereInput {
  return {
    OR: [
      { nextOccurrenceAt: { gte: now } },
      {
        AND: [
          { nextOccurrenceAt: null },
          {
            OR: [
              {
                scheduleMode: {
                  in: [
                    ScheduleMode.ALWAYS,
                    ScheduleMode.ON_DEMAND,
                    ScheduleMode.RECURRING,
                  ],
                },
              },
              {
                sessions: { some: { startsAt: { gte: now } } },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Публичная лента активностей / событий */
export function getPublicListingActivityWhere(
  now: Date = new Date()
): Prisma.ActivityWhereInput {
  return {
    AND: [
      publicListingActivityStatusWhere(),
      activityOwnerBusinessActiveWhere,
      getActivityNotExpiredForPublicWhere(now),
    ],
  };
}

/** Публичные офферы (через место) */
export function getPublicPublishedOfferWhere(
  now: Date = new Date()
): Prisma.OfferWhereInput {
  void now;
  return {
    AND: [{ status: "PUBLISHED" }, { place: placeOwnerBusinessActiveWhere }],
  };
}

export {
  getPlanActivityPublicAvailability,
  isPlacePubliclyVisible,
  type PlanActivityPublicAvailability,
} from "@/lib/plan/publicVisibility";

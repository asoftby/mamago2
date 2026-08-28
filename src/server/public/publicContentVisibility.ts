import type { Prisma } from "@prisma/client";
import { ContentStatus, ScheduleMode } from "@prisma/client";
import {
  activityOwnerBusinessActiveWhere,
  placeOwnerBusinessActiveWhere,
} from "@/server/business/businessOperationalPrisma";

export { activityOwnerBusinessActiveWhere, placeOwnerBusinessActiveWhere };

/**
 * Canonical public visibility for articles.
 *
 * `noindex` is deliberately not part of this predicate: it controls search
 * engine indexing, not whether a user may read the article by URL.
 */
export function getPublicPublishedArticleWhere(): Prisma.ArticleWhereInput {
  return { status: ContentStatus.PUBLISHED };
}

/**
 * Public Page detail/direct-link visibility.
 * UNLISTED pages are intentionally readable by direct URL but must not be
 * exposed in indexes/sitemaps.
 */
export function getPublicPageDetailWhere(): Prisma.PageWhereInput {
  return {
    status: "PUBLISHED",
    visibility: { in: ["PUBLIC", "UNLISTED"] },
  };
}

/** Public Page discovery/index visibility (sitemaps, listings). */
export function getPublicPageIndexWhere(): Prisma.PageWhereInput {
  return {
    status: "PUBLISHED",
    visibility: "PUBLIC",
  };
}

/**
 * Публичная выдача событий: «живые» карточки = не черновик, не первичная модерация, не правки/отклонено/удалено.
 * Используем `notIn`, а не `in: [PUBLISHED, PENDING_UPDATE]`: иначе часть рантаймов Prisma/Turbopack
 * валидирует массив `in` против устаревшего списка enum и падает на PENDING_UPDATE даже при актуальной БД.
 *
 * Важно: здесь намеренно сохраняется текущая семантика PENDING_UPDATE как
 * публичного live-состояния. Она будет убрана только при миграции Event на
 * revision-based publication lifecycle, а не в visibility-foundation.
 */
function publicListingActivityStatusWhere(): Prisma.ActivityWhereInput {
  return {
    status: {
      notIn: [
        ContentStatus.DRAFT,
        ContentStatus.PENDING,
        ContentStatus.NEEDS_REVISION,
        ContentStatus.REJECTED,
        ContentStatus.ARCHIVED,
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
      /**
       * Denormalized `nextOccurrenceAt` can lag behind session rewrites during edits.
       * Public feeds should still surface an event as soon as it has a future session.
       */
      {
        sessions: { some: { startsAt: { gte: now } } },
      },
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

/** Публичная лента активностей / событий (только будущие/актуальные) */
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

/**
 * Публичная detail-страница события: без фильтра по дате.
 * Позволяет открывать прошедшие события по прямой ссылке (SEO).
 * Проверяет только статус публикации и активность бизнеса.
 */
export function getPublicActivityDetailWhere(): Prisma.ActivityWhereInput {
  return {
    AND: [
      publicListingActivityStatusWhere(),
      activityOwnerBusinessActiveWhere,
    ],
  };
}

/** Публичные офферы (через место) */
export function getPublicPublishedOfferWhere(
  now: Date = new Date()
): Prisma.OfferWhereInput {
  return {
    AND: [
      { status: "PUBLISHED" },
      { archivedAt: null },
      { place: getPublicPublishedPlaceWhere(now) },
    ],
  };
}

export {
  getPlanActivityPublicAvailability,
  isPlacePubliclyVisible,
  type PlanActivityPublicAvailability,
} from "@/lib/plan/publicVisibility";

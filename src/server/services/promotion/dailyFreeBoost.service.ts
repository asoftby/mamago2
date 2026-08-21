import {
  AnalyticsEntityType,
  Prisma,
  UserEventType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import {
  getPublicListingActivityWhere,
  getPublicPublishedOfferWhere,
} from "@/server/public/publicContentVisibility";

export type FreeBoostPublicationType = "EVENT" | "OFFER";

export type FreeBoostCandidate = {
  id: string;
  title: string;
  publicationType: FreeBoostPublicationType;
};

export class DailyFreeBoostUnavailableError extends Error {
  code = "DAILY_FREE_BOOST_UNAVAILABLE" as const;
}

export class DailyFreeBoostTargetError extends Error {
  code = "DAILY_FREE_BOOST_TARGET_INVALID" as const;
}

const BOOST_DURATION_MS = 24 * 60 * 60 * 1000;

function isDailyUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function getFreeBoostCandidates(params: {
  businessId: string;
  userId: string;
  now?: Date;
}): Promise<FreeBoostCandidate[]> {
  const now = params.now ?? new Date();
  const [events, offers] = await Promise.all([
    prisma.activity.findMany({
      where: {
        AND: [
          getPublicListingActivityWhere(now),
          { type: "EVENT" },
          {
            OR: [
              { businessId: params.businessId },
              { ownerUserId: params.userId },
            ],
          },
        ],
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.offer.findMany({
      where: {
        AND: [
          getPublicPublishedOfferWhere(now),
          {
            place: {
              OR: [
                { ownerBusinessId: params.businessId },
                { createdByUserId: params.userId },
              ],
            },
          },
        ],
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return [
    ...events.map((event) => ({
      ...event,
      publicationType: "EVENT" as const,
    })),
    ...offers.map((offer) => ({
      ...offer,
      publicationType: "OFFER" as const,
    })),
  ];
}

async function resolveEligibleTarget(params: {
  businessId: string;
  userId: string;
  publicationId: string;
  publicationType: FreeBoostPublicationType;
  now: Date;
}) {
  const candidates = await getFreeBoostCandidates(params);
  return candidates.find(
    (candidate) =>
      candidate.id === params.publicationId &&
      candidate.publicationType === params.publicationType,
  ) ?? null;
}

export async function createDailyFreeBoost(params: {
  businessId: string;
  userId: string;
  publicationId: string;
  publicationType: FreeBoostPublicationType;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const dateKey = getLocalDateKey(now, DEFAULT_TZ);
  const target = await resolveEligibleTarget({ ...params, now });
  if (!target) {
    throw new DailyFreeBoostTargetError(
      "Выбрать можно только свою опубликованную и доступную пользователям публикацию.",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const alreadyUsed = await tx.boost.findUnique({
        where: {
          businessId_freeDailyDateKey: {
            businessId: params.businessId,
            freeDailyDateKey: dateKey,
          },
        },
        select: { id: true },
      });
      if (alreadyUsed) {
        throw new DailyFreeBoostUnavailableError(
          "Сегодня бесплатное поднятие уже использовано.",
        );
      }

      const activeTargetBoost = await tx.boost.findFirst({
        where: {
          ...(params.publicationType === "EVENT"
            ? { activityId: params.publicationId }
            : { offerId: params.publicationId }),
          startAt: { lte: now },
          endAt: { gt: now },
        },
        select: { id: true },
      });
      if (activeTargetBoost) {
        throw new DailyFreeBoostTargetError(
          "У этой публикации уже действует продвижение. Выберите другую.",
        );
      }

      return tx.boost.create({
        data: {
          businessId: params.businessId,
          offerId:
            params.publicationType === "OFFER" ? params.publicationId : null,
          activityId:
            params.publicationType === "EVENT" ? params.publicationId : null,
          startAt: now,
          endAt: new Date(now.getTime() + BOOST_DURATION_MS),
          durationDays: 1,
          price: new Prisma.Decimal(0),
          currency: "BYN",
          isFreeDaily: true,
          freeDailyDateKey: dateKey,
        },
      });
    });
  } catch (error) {
    if (isDailyUniqueConflict(error)) {
      throw new DailyFreeBoostUnavailableError(
        "Сегодня бесплатное поднятие уже использовано.",
      );
    }
    throw error;
  }
}

export async function getDailyFreeBoostDashboardData(params: {
  businessId: string;
  userId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const dateKey = getLocalDateKey(now, DEFAULT_TZ);
  const [candidates, boost] = await Promise.all([
    getFreeBoostCandidates({ ...params, now }),
    prisma.boost.findUnique({
      where: {
        businessId_freeDailyDateKey: {
          businessId: params.businessId,
          freeDailyDateKey: dateKey,
        },
      },
      include: {
        offer: { select: { title: true } },
        activity: { select: { title: true } },
      },
    }),
  ]);

  if (!boost) {
    return { availableToday: true, candidates, boost: null };
  }

  const publicationType = boost.activityId
    ? ("EVENT" as const)
    : ("OFFER" as const);
  const publicationId = boost.activityId ?? boost.offerId!;
  const metricRows = await prisma.userEvent.groupBy({
    by: ["eventType"],
    where: {
      entityType:
        publicationType === "EVENT"
          ? AnalyticsEntityType.EVENT
          : AnalyticsEntityType.OFFER,
      entityId: publicationId,
      createdAt: {
        gte: boost.startAt,
        lte: now < boost.endAt ? now : boost.endAt,
      },
      eventType: {
        in: [
          UserEventType.PAGE_VIEW,
          UserEventType.CARD_VIEW,
          UserEventType.SAVE,
          UserEventType.PLAN_ADD,
          UserEventType.CTA_CLICK,
        ],
      },
    },
    _count: { _all: true },
  });
  const count = (types: UserEventType[]) =>
    metricRows
      .filter((row) => types.includes(row.eventType))
      .reduce((sum, row) => sum + row._count._all, 0);

  return {
    availableToday: false,
    candidates,
    boost: {
      id: boost.id,
      publicationId,
      publicationType,
      publicationTitle: boost.activity?.title ?? boost.offer?.title ?? "Публикация",
      startAt: boost.startAt,
      endAt: boost.endAt,
      metrics: {
        views: count([UserEventType.PAGE_VIEW, UserEventType.CARD_VIEW]),
        saves: count([UserEventType.SAVE, UserEventType.PLAN_ADD]),
        ctaClicks: count([UserEventType.CTA_CLICK]),
      },
    },
  };
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/Container";
import { IdeasClient } from "./IdeasClient";
import type { IdeaItem } from "./types";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { listOfferIdeas } from "@/server/services/idea.service";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { resolveIdeaPlanState } from "@/lib/plan/ideaPlanStatus";
import { getEventTemporalState } from "@/lib/events/eventTemporalState";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { normalizePricingMode } from "@/components/business/wizard/event/pricingMode";

export const metadata = { title: "Мои идеи — mamaGo" };

function extractActivityDateRange(input: {
  nextOccurrenceAt: Date | null;
  sessions: Array<{ startsAt: Date }>;
}): {
  dateStart: string | null;
  dateEnd: string | null;
} {
  const timestamps = input.sessions.map((session) => session.startsAt.getTime());
  if (input.nextOccurrenceAt) {
    timestamps.push(input.nextOccurrenceAt.getTime());
  }

  if (timestamps.length === 0) {
    return { dateStart: null, dateEnd: null };
  }

  const start = new Date(Math.min(...timestamps));
  const end = new Date(Math.max(...timestamps));
  const dateStart = start.toISOString();

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  return {
    dateStart,
    dateEnd: isSameDay ? null : end.toISOString(),
  };
}

function discoveryCardPriceUsesOtPrefix(a: {
  scheduleJson: unknown;
  priceText: string | null;
  priceFrom: number | null;
  priceTo: number | null;
}): boolean {
  const scheduleJson = a.scheduleJson as Record<string, unknown> | null | undefined;
  const mode = normalizePricingMode(scheduleJson?.pricingMode, {
    priceText: a.priceText,
    priceFrom: a.priceFrom,
    priceTo: a.priceTo,
  });
  return mode === "from";
}

function getOfferKindLabel(offer: {
  kind?: string | null;
  campProgramType?: string | null;
}): string | null {
  if (offer.campProgramType) return "ЛАГЕРЬ";

  switch (offer.kind) {
    case "CLASS":
      return "ЗАНЯТИЯ";
    case "SERVICE":
      return "УСЛУГА";
    case "EVENT":
      return "СОБЫТИЕ";
    case "PARTY":
      return "ПРАЗДНИК";
    case "VISIT":
      return "ПОСЕЩЕНИЕ";
    default:
      return null;
  }
}

function getOfferAgeLabel(ageMinMonths: number | null | undefined): string | null {
  if (ageMinMonths == null) return null;
  return `${Math.max(0, Math.floor(ageMinMonths / 12))}+`;
}

function getOfferPriceLabel(offer: {
  priceText?: string | null;
  priceFrom?: number | null;
  currency?: string | null;
}): string | null {
  if (offer.priceFrom == null) {
    const direct = offer.priceText?.trim();
    return direct || null;
  }
  if (offer.priceFrom === 0) return "бесплатно";

  const currency = offer.currency?.trim() || "BYN";
  return `от ${offer.priceFrom} ${currency}`;
}

function getOfferDateMetaLabel(offer: {
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  campSessions?: unknown;
}): string | null {
  const ageLabel = getOfferAgeLabel(offer.ageMinMonths);
  const timestamps: number[] = [];
  if (offer.dateFrom) timestamps.push(offer.dateFrom.getTime());
  if (offer.dateTo) timestamps.push(offer.dateTo.getTime());
  if (Array.isArray(offer.campSessions)) {
    for (const session of offer.campSessions) {
      if (!session || typeof session !== "object") continue;
      const record = session as Record<string, unknown>;
      for (const value of [record.dateFrom, record.dateTo]) {
        if (typeof value !== "string") continue;
        const parsed = new Date(value).getTime();
        if (Number.isFinite(parsed)) timestamps.push(parsed);
      }
    }
  }

  const dateRange =
    timestamps.length > 0
      ? formatRuShortDayMonthRange(
          new Date(Math.min(...timestamps)).toISOString(),
          new Date(Math.max(...timestamps)).toISOString(),
        )
      : null;

  const parts = [ageLabel, dateRange].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Маршрут сохранённый в «Идеи» — для построения IdeaItem */
type RouteIdeaRow = {
  id: string;
  createdAt: Date;
  route: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string | null;
    city: { name: string; slug: string } | null;
  } | null;
};

async function getUserRouteIdeas(userId: string): Promise<RouteIdeaRow[]> {
  try {
    const rows = await prisma.routeIdea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        route: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImageUrl: true,
            city: { select: { name: true, slug: true } },
          },
        },
      },
    });
    return rows as unknown as RouteIdeaRow[];
  } catch {
    return [];
  }
}

async function getUserIdeas(userId: string): Promise<IdeaItem[]> {
  const todayISO = getLocalDateKey();
  const [ideas, offerIdeas, routeIdeas] = await Promise.all([
    prisma.idea.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    listOfferIdeas(userId),
    getUserRouteIdeas(userId),
  ]);

  if (ideas.length === 0 && offerIdeas.length === 0 && routeIdeas.length === 0) return [];

  const activityIds = ideas.map((i) => i.activityId);
  const routeIds = routeIdeas
    .map((idea) => idea.route?.id)
    .filter((id): id is string => Boolean(id));

  const activities = await prisma.activity.findMany({
    where: { id: { in: activityIds } },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      format: true,
      coverImageUrl: true,
      coverImageId: true,
      images: {
        take: 1,
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, mediaAssetId: true },
      },
      ageMinMonths: true,
      ageMaxMonths: true,
      ageTags: true,
      ageLabel: true,
      priceText: true,
      priceFrom: true,
      priceTo: true,
      currency: true,
      priceDetails: true,
      scheduleJson: true,
      scheduleMode: true,
      status: true,
      nextOccurrenceAt: true,
      sessions: {
        orderBy: { startsAt: "asc" },
        take: 100,
        select: { startsAt: true },
      },
      owner: {
        select: {
          business: { select: { operationalStatus: true } },
        },
      },
      place: {
        select: {
          title: true,
          formattedAddr: true,
          shortAddress: true,
          city: { select: { name: true, slug: true } },
        },
      },
      venue: {
        select: {
          title: true,
          addressLine: true,
        },
      },
      eventCategory: {
        select: {
          nameRu: true,
        },
      },
    },
  });

  const activityMap = new Map(activities.map((a) => [a.id, a]));

  // Check which activities are already planned
  const planLookupConditions = [];
  if (activityIds.length > 0) {
    planLookupConditions.push({ activityId: { in: activityIds } });
  }
  if (routeIds.length > 0) {
    planLookupConditions.push({ routeId: { in: routeIds } });
  }

  const plannedItems = planLookupConditions.length
    ? await prisma.planItem.findMany({
    where: {
      userId,
      OR: planLookupConditions,
    },
    select: { id: true, activityId: true, routeId: true, date: true },
    orderBy: { date: "asc" },
  })
    : [];
  const plannedByActivityId = new Map<string, Array<{ id: string; date: string }>>();
  const plannedByRouteId = new Map<string, Array<{ id: string; date: string }>>();
  for (const item of plannedItems) {
    if (item.activityId) {
      const existing = plannedByActivityId.get(item.activityId) ?? [];
      existing.push({ id: item.id, date: item.date });
      plannedByActivityId.set(item.activityId, existing);
    }
    if (item.routeId) {
      const existing = plannedByRouteId.get(item.routeId) ?? [];
      existing.push({ id: item.id, date: item.date });
      plannedByRouteId.set(item.routeId, existing);
    }
  }

  const activityIdeaItems = ideas
    .map((idea) => {
      const activity = activityMap.get(idea.activityId);
      if (!activity) return null;

      const { dateStart, dateEnd } = extractActivityDateRange({
        nextOccurrenceAt: activity.nextOccurrenceAt,
        sessions: activity.sessions,
      });
      const planState = resolveIdeaPlanState(
        plannedByActivityId.get(idea.activityId) ?? [],
        todayISO,
      );
      const temporalState = getEventTemporalState({
        scheduleMode: activity.scheduleMode,
        nextOccurrenceAt: activity.nextOccurrenceAt,
        sessions: activity.sessions,
      });

      return {
        id: idea.id,
        ideaType: "ACTIVITY",
        activity: {
          id: activity.id,
          slug: activity.slug ?? null,
          citySlug: activity.place?.city?.slug ?? null,
          title: activity.title,
          type: activity.type as IdeaItem["activity"]["type"],
          format: activity.format ?? null,
          coverImageUrl: resolveActivityCoverUrl({
            coverImageId: activity.coverImageId,
            coverImageUrl: activity.coverImageUrl,
            images: activity.images,
          }) ?? null,
          ageTags: activity.ageTags,
          ageMinMonths: activity.ageMinMonths ?? null,
          ageMaxMonths: activity.ageMaxMonths ?? null,
          ageLabel: activity.ageLabel ?? null,
          dateStart,
          dateEnd,
          priceFrom: activity.priceFrom ?? null,
          priceMax: activity.priceTo ?? null,
          priceText: activity.priceText ?? null,
          priceListUsesOt: discoveryCardPriceUsesOtPrefix({
            scheduleJson: activity.scheduleJson,
            priceText: activity.priceText,
            priceFrom: activity.priceFrom,
            priceTo: activity.priceTo,
          }),
          currency: activity.currency ?? null,
          publicHref: publicActivityPath(
            activity.id,
            activity.place?.city?.slug ?? null,
            activity.slug ?? null,
          ),
          placeTitle: activity.place?.title ?? activity.venue?.title ?? null,
          addressLabel:
            activity.place?.formattedAddr ??
            activity.place?.shortAddress ??
            activity.venue?.addressLine ??
            null,
          categoryLabel: activity.eventCategory?.nameRu ?? null,
          badgeLabel: activity.format ?? null,
          temporalState,
        },
        planAvailability: getPlanActivityPublicAvailability(activity),
        planStatus: planState.planStatus,
        isPlanned: planState.isPlanned,
        plannedDate: planState.plannedDate,
        planItemId: planState.planItemId,
        createdAt: idea.createdAt.toISOString(),
      } satisfies IdeaItem;
    })
    .filter(Boolean) as IdeaItem[];

  const offerIdeaItems = offerIdeas
    .map((idea) => {
      const offer = idea.offer;
      if (!offer?.slug || !offer.place?.city?.slug) return null;

      return {
        id: idea.id,
        ideaType: "OFFER",
        activity: {
          id: offer.id,
          title: offer.title,
          type: "OFFER" as const,
          coverImageUrl: offer.coverImage ?? null,
          ageMinMonths: offer.ageMinMonths ?? null,
          ageMaxMonths: offer.ageMaxMonths ?? null,
          dateStart: offer.dateFrom?.toISOString().split("T")[0] ?? null,
          dateEnd: offer.dateTo?.toISOString().split("T")[0] ?? null,
          priceFrom: offer.priceFrom ?? null,
          currency: "BYN" as const,
          publicHref: getOfferPublicPath(offer as never, offer.place.city.slug),
          placeTitle: offer.place.title,
          addressLabel: offer.place.formattedAddr ?? offer.place.shortAddress ?? null,
          dateLabel: getOfferDateMetaLabel(offer),
          priceText: getOfferPriceLabel({ ...offer, currency: "BYN" }),
          categoryLabel: [getOfferKindLabel(offer), "ОФЛАЙН"].filter(Boolean).join(" · ") || null,
          kind: offer.kind ?? null,
          campProgramType: offer.campProgramType ?? null,
        },
        planAvailability: undefined,
        planStatus: "UNPLANNED" as const,
        isPlanned: false,
        plannedDate: undefined,
        createdAt: idea.createdAt.toISOString(),
      } satisfies IdeaItem;
    })
    .filter(Boolean) as IdeaItem[];

  const routeIdeaItems = routeIdeas
    .map((idea): IdeaItem | null => {
      const route = idea.route;
      if (!route?.slug) return null;
      const citySlug = route.city?.slug;
      if (!citySlug) return null;
      const planState = resolveIdeaPlanState(
        plannedByRouteId.get(route.id) ?? [],
        todayISO,
      );

      return {
        id: idea.id,
        ideaType: "ROUTE",
        activity: {
          id: route.id,
          title: route.title,
          type: "ROUTE" as const,
          coverImageUrl: route.coverImageUrl ?? null,
          publicHref: `/${citySlug}/routes/${route.slug}`,
          placeTitle: route.city?.name ?? null,
          addressLabel: route.city?.name ?? null,
        },
        planAvailability: undefined,
        planStatus: planState.planStatus,
        isPlanned: planState.isPlanned,
        plannedDate: planState.plannedDate,
        planItemId: planState.planItemId,
        createdAt: idea.createdAt.toISOString(),
      } satisfies IdeaItem;
    })
    .filter((item): item is IdeaItem => item !== null);

  return [...activityIdeaItems, ...offerIdeaItems, ...routeIdeaItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export default async function IdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ideas = await getUserIdeas(user.id);

  return (
    <div className="min-h-screen bg-[#FCFBF8]">
      <Container className="max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8 lg:px-8 lg:pt-10">
        <IdeasClient initialIdeas={ideas} discoveryHref="/minsk" />
      </Container>
    </div>
  );
}

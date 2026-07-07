import { Suspense } from "react";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ActivityType, ContentStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";
import { getEventTemporalState } from "@/lib/events/eventTemporalState";
import { cn } from "@/lib/utils";
import { publicActivityPath, toAbsolutePublicUrl } from "@/lib/business/eventPublicLink";
import { ContentLifecycleStatusBadge } from "@/components/contentLifecycle/ContentLifecycleStatusBadge";
import { ContentLifecycleActionsMenu } from "@/components/contentLifecycle/ContentLifecycleActionsMenu";
import {
  buildAdminEventLifecycleInput,
  buildAdminLifecycleViewModel,
} from "@/lib/contentLifecycle/buildAdminLifecycleViewModel";

/** Список после DELETE из API должен перечитываться; иначе RSC может отдавать закэшированный снимок. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseContentStatusFilter(
  raw: string | undefined,
): ContentStatus | undefined {
  if (!raw) return undefined;
  return Object.values(ContentStatus).includes(raw as ContentStatus)
    ? (raw as ContentStatus)
    : undefined;
}

interface SearchParams {
  status?: string;
  cityId?: string;
  temporal?: string;
}

function parseTemporalFilter(
  raw: string | undefined,
): "active" | "past" | undefined {
  if (raw === "active" || raw === "past") return raw;
  return undefined;
}

async function getActivities(params: SearchParams) {
  const status = parseContentStatusFilter(params.status);
  const temporal = parseTemporalFilter(params.temporal);

  const where: Prisma.ActivityWhereInput = {
    type: ActivityType.EVENT,
    ...(status ? { status } : { status: { in: activityStatusesExcludingDeleted() } }),
  };

  if (params.cityId) {
    where.OR = [
      { cityId: params.cityId },
      { place: { cityId: params.cityId } },
    ];
  }

  const activities = await prisma.activity.findMany({
    where,
    include: {
      sessions: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
      place: {
        select: {
          title: true,
          city: { select: { name: true, slug: true } },
        },
      },
      owner: {
        select: {
          email: true,
          business: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (!temporal) {
    return activities;
  }

  return activities.filter((activity) => {
    const temporalState = getEventTemporalState({
      scheduleMode: activity.scheduleMode,
      nextOccurrenceAt: activity.nextOccurrenceAt,
      sessions: activity.sessions,
    });

    if (temporal === "past") {
      return temporalState === "PAST";
    }

    return temporalState === "UPCOMING" || temporalState === "ONGOING";
  });
}

function ActivitiesTable({
  activities,
  cityNameById,
}: {
  activities: Awaited<ReturnType<typeof getActivities>>;
  cityNameById: Map<string, string>;
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>События не найдены</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Создано</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {activities.map((activity) => {
            const lifecycleViewModel = buildAdminLifecycleViewModel({
              ...buildAdminEventLifecycleInput({ status: activity.status }),
              navigationLinks: {
                edit: true,
                preview: true,
                review: activity.status === ContentStatus.PENDING,
              },
            });
            const temporalState = getEventTemporalState({
              scheduleMode: activity.scheduleMode,
              nextOccurrenceAt: activity.nextOccurrenceAt,
              sessions: activity.sessions,
            });
            const temporalLabel =
              activity.status === ContentStatus.PUBLISHED
                ? temporalState === "PAST"
                  ? "Уже прошло"
                  : temporalState === "UPCOMING" || temporalState === "ONGOING"
                    ? "Актуально"
                    : null
                : null;
            const cityLabel =
              activity.place?.city?.name ||
              (activity.cityId ? cityNameById.get(activity.cityId) : undefined) ||
              "—";
            const publicHref =
              activity.status === ContentStatus.PUBLISHED ||
              activity.status === ContentStatus.PENDING_UPDATE ||
              activity.status === ContentStatus.SCHEDULED
                ? toAbsolutePublicUrl(
                    publicActivityPath(
                      activity.id,
                      activity.place?.city?.slug ?? null,
                      activity.slug ?? null,
                    ),
                  )
                : null;
            return (
              <tr key={activity.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{activity.title}</td>
                <td className="px-4 py-3 text-gray-600">{cityLabel}</td>
                <td className="px-4 py-3 text-gray-600">
                  {activity.owner?.business?.name || activity.owner?.email || "—"}
                </td>
                <td className="px-4 py-3">
                  <ContentLifecycleStatusBadge
                    viewModel={lifecycleViewModel}
                    secondary={
                      temporalLabel
                        ? [
                            {
                              label: temporalLabel,
                              className: cn(
                                temporalState === "PAST"
                                  ? "text-muted-foreground"
                                  : "text-emerald-600",
                              ),
                            },
                          ]
                        : undefined
                    }
                  />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <ContentLifecycleActionsMenu
                    viewModel={lifecycleViewModel}
                    contentId={activity.id}
                    contentType="event"
                    surface="admin"
                    links={{
                      edit: {
                        href: `/editor/event/${activity.id}/edit?returnTo=${encodeURIComponent("/admin/content/events")}`,
                        label: "Редактировать",
                      },
                      preview: publicHref
                        ? {
                            href: publicHref,
                            newTab: true,
                            label: "Открыть публичную страницу",
                          }
                        : {
                            href: `/me/events/${activity.id}/preview`,
                            label: "Открыть предпросмотр",
                          },
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ModerationEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [activities, cities] = await Promise.all([
    getActivities(params),
    getModerationFilterCities(),
  ]);

  const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">События</h1>
          <p className="text-sm text-gray-600 mt-1">
            Активности (ContentStatus) — те же фильтры статуса и города, что у «Мест»
          </p>
        </div>
      </div>

      <ModerationListFilters
        cities={cities}
        basePath="/admin/content/events"
        statusFilter="content"
        showTemporalFilter
      />

      <Suspense fallback={<div>Загрузка…</div>}>
        <ActivitiesTable activities={activities} cityNameById={cityNameById} />
      </Suspense>
    </div>
  );
}

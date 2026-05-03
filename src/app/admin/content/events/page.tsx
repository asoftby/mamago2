import { Suspense } from "react";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ActivityType, ContentStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { AdminEventRowActions } from "@/components/admin/moderation/AdminEventRowActions";
import { MODERATION_CONTENT_STATUS_CONFIG } from "@/lib/admin/moderationContentStatusBadges";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";

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
}

async function getActivities(params: SearchParams) {
  const status = parseContentStatusFilter(params.status);

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

  return prisma.activity.findMany({
    where,
    include: {
      place: {
        select: {
          title: true,
          city: { select: { name: true } },
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
            const statusConfig =
              MODERATION_CONTENT_STATUS_CONFIG[activity.status] ||
              MODERATION_CONTENT_STATUS_CONFIG.DRAFT;
            const cityLabel =
              activity.place?.city?.name ||
              (activity.cityId ? cityNameById.get(activity.cityId) : undefined) ||
              "—";
            return (
              <tr key={activity.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{activity.title}</td>
                <td className="px-4 py-3 text-gray-600">{cityLabel}</td>
                <td className="px-4 py-3 text-gray-600">
                  {activity.owner?.business?.name || activity.owner?.email || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <AdminEventRowActions
                    eventId={activity.id}
                    status={activity.status}
                    returnTo="/admin/content/events"
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
      />

      <Suspense fallback={<div>Загрузка…</div>}>
        <ActivitiesTable activities={activities} cityNameById={cityNameById} />
      </Suspense>
    </div>
  );
}

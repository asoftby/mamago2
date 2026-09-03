import { Suspense } from "react";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ActivityType, ContentStatus, ScheduleMode } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { getAdminPagination, parseAdminPage } from "@/lib/admin/pagination";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";
import { getEventTemporalState } from "@/lib/events/eventTemporalState";
import { cn } from "@/lib/utils";
import { publicActivityPath, toAbsolutePublicUrl } from "@/lib/business/eventPublicLink";
import {
  blockingDependencyItems,
  type ContentDependencySummary,
} from "@/lib/admin/contentDependencySummary";
import {
  deriveActivityArchivedDeletePreflight,
  deriveActivityDeletePreflight,
  getActivitiesDependencySummariesBatch,
} from "@/server/services/contentDependencySummary.service";
import { ContentLifecycleStatusBadge } from "@/components/contentLifecycle/ContentLifecycleStatusBadge";
import { ContentLifecycleActionsMenu } from "@/components/contentLifecycle/ContentLifecycleActionsMenu";
import {
  buildAdminEventLifecycleInput,
  buildAdminLifecycleViewModel,
} from "@/lib/contentLifecycle/buildAdminLifecycleViewModel";
import { TableContainer } from "@/components/ui/table";
import { agePolicyLabel } from "@/lib/age/agePolicy";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardRow,
  DataCardActions,
} from "@/components/ui/data-card-list";

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
  q?: string;
  status?: string;
  cityId?: string;
  temporal?: string;
  page?: string;
  [key: string]: string | undefined;
}

function parseTemporalFilter(
  raw: string | undefined,
): "active" | "past" | undefined {
  if (raw === "active" || raw === "past") return raw;
  return undefined;
}

function buildReturnTo(params: SearchParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  });
  const search = query.toString();
  return `/admin/content/events${search ? `?${search}` : ""}`;
}

function buildTemporalWhere(
  temporal: "active" | "past" | undefined,
): Prisma.ActivityWhereInput | null {
  if (!temporal) return null;

  const now = new Date();

  if (temporal === "past") {
    return {
      OR: [
        {
          sessions: {
            some: {},
            none: { startsAt: { gte: now } },
          },
        },
        {
          sessions: { none: {} },
          nextOccurrenceAt: { lt: now },
        },
      ],
    };
  }

  return {
    OR: [
      { sessions: { some: { startsAt: { gte: now } } } },
      {
        sessions: { none: {} },
        nextOccurrenceAt: { gte: now },
      },
      {
        sessions: { none: {} },
        nextOccurrenceAt: null,
        scheduleMode: {
          in: [ScheduleMode.ALWAYS, ScheduleMode.ON_DEMAND, ScheduleMode.RECURRING],
        },
      },
    ],
  };
}

async function getActivities(params: SearchParams) {
  const status = parseContentStatusFilter(params.status);
  const temporal = parseTemporalFilter(params.temporal);
  const q = params.q?.trim();

  const where: Prisma.ActivityWhereInput = {
    type: ActivityType.EVENT,
    ...(status ? { status } : { status: { in: activityStatusesExcludingDeleted() } }),
  };
  const and: Prisma.ActivityWhereInput[] = [];

  if (params.cityId) {
    and.push({
      OR: [
        { cityId: params.cityId },
        { place: { cityId: params.cityId } },
      ],
    });
  }

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { place: { title: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const temporalWhere = buildTemporalWhere(temporal);
  if (temporalWhere) {
    and.push(temporalWhere);
  }

  if (and.length > 0) {
    where.AND = and;
  }

  const total = await prisma.activity.count({ where });
  const pagination = getAdminPagination({
    page: parseAdminPage(params.page),
    total,
  });

  const items = await prisma.activity.findMany({
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
    skip: pagination.skip,
    take: pagination.take,
  });

  return { items, pagination };
}

const EMPTY_DEPENDENCY_SUMMARY: ContentDependencySummary = {
  total: 0,
  blockingTotal: 0,
  items: [],
};

type ActivityRowMeta = {
  dependencySummary: ContentDependencySummary;
  deletePreflight: ReturnType<typeof deriveActivityDeletePreflight>;
  archivedDeletePreflight: ReturnType<typeof deriveActivityArchivedDeletePreflight>;
};

type ActivityListItem = Awaited<ReturnType<typeof getActivities>>["items"][number];

function ActivitiesTable({
  activities,
  cityNameById,
  activityMetaById,
  returnTo,
}: {
  activities: ActivityListItem[];
  cityNameById: Map<string, string>;
  activityMetaById: Map<string, ActivityRowMeta>;
  returnTo: string;
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>События не найдены</p>
      </div>
    );
  }

  const rows = activities.map((activity) => {
    const rowMeta = activityMetaById.get(activity.id) ?? {
      dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      deletePreflight: {
        allowed: activity.status === ContentStatus.DRAFT,
        reasons: [],
        message: undefined,
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
      archivedDeletePreflight: {
        allowed: false,
        reasons: ["notArchived"],
        message: undefined,
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
    };
    const blockingItems = blockingDependencyItems(rowMeta.dependencySummary);
    const lifecycleViewModel = buildAdminLifecycleViewModel({
      ...buildAdminEventLifecycleInput({
        status: activity.status,
        deletePreflight: rowMeta.deletePreflight,
        archivedDeletePreflight: rowMeta.archivedDeletePreflight,
      }),
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

    const statusBadge = (
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
    );

    const actionsMenu = (
      <ContentLifecycleActionsMenu
        viewModel={lifecycleViewModel}
        contentId={activity.id}
        contentType="event"
        surface="admin"
        links={{
          edit: {
            href: `/editor/event/${activity.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
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
        deletePreflight={{
          deleteDraft: {
            blockedDialog: !rowMeta.deletePreflight.allowed
              ? {
                  title: "Нельзя удалить черновик",
                  description: rowMeta.deletePreflight.message,
                  items: blockingItems,
                }
              : null,
          },
          deleteArchived: {
            blockedDialog: !rowMeta.archivedDeletePreflight.allowed
              ? {
                  title: "Нельзя удалить из архива",
                  description: rowMeta.archivedDeletePreflight.message,
                  items: blockingItems,
                }
              : null,
          },
        }}
      />
    );

    const businessLabel = activity.owner?.business?.name || activity.owner?.email || "—";

    return { activity, cityLabel, businessLabel, statusBadge, actionsMenu };
  });

  return (
    <>
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
        <TableContainer
          minWidthClassName="min-w-[880px]"
          scrollLabel="Список событий, прокручивается по горизонтали"
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Возраст</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Создано</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map(({ activity, cityLabel, businessLabel, statusBadge, actionsMenu }) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{activity.title}</td>
                  <td className="px-4 py-3 text-gray-600">{cityLabel}</td>
                  <td className="px-4 py-3 text-gray-600">{businessLabel}</td>
                  <td className="px-4 py-3">{statusBadge}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {activity.agePolicy === "SPECIFIC"
                      ? activity.ageLabel || activity.ageTags.join(", ")
                      : agePolicyLabel(activity.agePolicy)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: ru })}
                  </td>
                  <td className="px-4 py-3">{actionsMenu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      </div>

      <DataCardList>
        {rows.map(({ activity, cityLabel, businessLabel, statusBadge, actionsMenu }) => (
          <DataCard key={activity.id}>
            <DataCardHeader
              title={activity.title}
              subtitle={cityLabel === "—" ? undefined : cityLabel}
              badge={statusBadge}
            />
            <DataCardBody>
              <DataCardRow
                label="Бизнес"
                value={businessLabel === "—" ? null : businessLabel}
              />
              <DataCardRow
                label="Возраст"
                value={
                  activity.agePolicy === "SPECIFIC"
                    ? activity.ageLabel || activity.ageTags.join(", ")
                    : agePolicyLabel(activity.agePolicy)
                }
              />
              <DataCardRow
                label="Создано"
                value={formatDistanceToNow(activity.createdAt, {
                  addSuffix: true,
                  locale: ru,
                })}
              />
            </DataCardBody>
            <DataCardActions>{actionsMenu}</DataCardActions>
          </DataCard>
        ))}
      </DataCardList>
    </>
  );
}

export default async function ModerationEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [activitiesResult, cities] = await Promise.all([
    getActivities(params),
    getModerationFilterCities(),
  ]);
  const { items: activities, pagination } = activitiesResult;

  const dependencySummaries = await getActivitiesDependencySummariesBatch(
    activities.map((activity) => activity.id),
    prisma,
  );
  const activityMetaById = new Map<string, ActivityRowMeta>(
    activities.map((activity) => {
      const dependencySummary =
        dependencySummaries.get(activity.id) ?? EMPTY_DEPENDENCY_SUMMARY;
      return [
        activity.id,
        {
          dependencySummary,
          deletePreflight: deriveActivityDeletePreflight({
            status: activity.status,
            dependencySummary,
          }),
          archivedDeletePreflight: deriveActivityArchivedDeletePreflight({
            status: activity.status,
            dependencySummary,
          }),
        },
      ];
    }),
  );

  const cityNameById = new Map(cities.map((c) => [c.id, c.name]));
  const returnTo = buildReturnTo(params);

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
        <ActivitiesTable
          activities={activities}
          cityNameById={cityNameById}
          activityMetaById={activityMetaById}
          returnTo={returnTo}
        />
      </Suspense>

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        start={pagination.start}
        end={pagination.end}
        basePath="/admin/content/events"
        params={params}
      />
    </div>
  );
}

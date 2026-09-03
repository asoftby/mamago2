import { Suspense } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Prisma, RouteStatus, RouteVisibility } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { TableContainer } from "@/components/ui/table";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { getAdminPagination, parseAdminPage } from "@/lib/admin/pagination";
import {
  blockingDependencyItems,
  buildContentDependencySummary,
} from "@/lib/admin/contentDependencySummary";
import { ContentLifecycleActionsMenu } from "@/components/contentLifecycle/ContentLifecycleActionsMenu";
import { ContentLifecycleStatusBadge } from "@/components/contentLifecycle/ContentLifecycleStatusBadge";
import {
  buildAdminLifecycleViewModel,
  buildAdminRouteLifecycleInput,
} from "@/lib/contentLifecycle/buildAdminLifecycleViewModel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  q?: string;
  status?: string;
  cityId?: string;
  visibility?: string;
  authorId?: string;
  page?: string;
  [key: string]: string | undefined;
};

const EDITORIAL_AUTHOR_FILTER = "__editorial";

function parseRouteStatus(raw: string | undefined): RouteStatus | undefined {
  if (!raw) return undefined;
  return Object.values(RouteStatus).includes(raw as RouteStatus)
    ? (raw as RouteStatus)
    : undefined;
}

function parseRouteVisibility(raw: string | undefined): RouteVisibility | undefined {
  if (!raw) return undefined;
  return Object.values(RouteVisibility).includes(raw as RouteVisibility)
    ? (raw as RouteVisibility)
    : undefined;
}

function buildReturnTo(params: SearchParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  });
  const search = query.toString();
  return `/admin/content/routes${search ? `?${search}` : ""}`;
}

async function getRoutes(params: SearchParams) {
  const status = parseRouteStatus(params.status);
  const visibility = parseRouteVisibility(params.visibility);
  const q = params.q?.trim();

  const where: Prisma.RouteWhereInput = {};

  if (status) where.status = status;
  if (visibility) where.visibility = visibility;
  if (params.cityId) where.cityId = params.cityId;
  if (params.authorId === EDITORIAL_AUTHOR_FILTER) {
    where.authorId = null;
  } else if (params.authorId) {
    where.authorId = params.authorId;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const total = await prisma.route.count({ where });
  const pagination = getAdminPagination({
    page: parseAdminPage(params.page),
    total,
  });

  const items = await prisma.route.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: pagination.skip,
    take: pagination.take,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      visibility: true,
      updatedAt: true,
      authorId: true,
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true, displayName: true } },
      _count: {
        select: {
          stops: true,
          planItems: true,
          routeIdeas: true,
          ratings: true,
        },
      },
    },
  });

  return { items, pagination };
}

type RouteListItem = Awaited<ReturnType<typeof getRoutes>>["items"][number];

function routeDependencySummary(route: RouteListItem) {
  return buildContentDependencySummary([
    {
      type: "planItems",
      label: "В планах пользователей",
      count: route._count.planItems,
      blocking: true,
    },
    {
      type: "routeIdeas",
      label: "В идеях пользователей",
      count: route._count.routeIdeas,
      blocking: true,
    },
    {
      type: "ratings",
      label: "Оценки маршрута",
      count: route._count.ratings,
      blocking: true,
    },
  ]);
}

function routeDeletePreflight(route: RouteListItem) {
  const dependencySummary = routeDependencySummary(route);
  const reasons = [
    ...(route.status !== RouteStatus.DRAFT ? ["statusNotDraft"] : []),
    ...(dependencySummary.blockingTotal > 0 ? ["dependencies"] : []),
  ];

  return {
    allowed: reasons.length === 0,
    reasons,
    message:
      reasons.length > 0
        ? "Удаление доступно только для изолированных черновиков маршрутов."
        : undefined,
    dependencySummary,
  };
}

function statusLabel(status: RouteStatus) {
  switch (status) {
    case RouteStatus.DRAFT:
      return "Черновик";
    case RouteStatus.PUBLISHED:
      return "Опубликован";
    case RouteStatus.ARCHIVED:
      return "Архив";
  }
}

function visibilityLabel(visibility: RouteVisibility) {
  switch (visibility) {
    case RouteVisibility.PUBLIC:
      return "Публичный";
    case RouteVisibility.UNLISTED:
      return "По ссылке";
    case RouteVisibility.PRIVATE:
      return "Приватный";
  }
}

function RoutesFilters({
  params,
  cities,
  authors,
}: {
  params: SearchParams;
  cities: { id: string; name: string }[];
  authors: { id: string; label: string }[];
}) {
  return (
    <form
      action="/admin/content/routes"
      className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1.5fr)_repeat(4,minmax(140px,1fr))_auto]"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="routes-q">
          Поиск
        </label>
        <input
          id="routes-q"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Название или slug"
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="routes-status">
          Статус
        </label>
        <select
          id="routes-status"
          name="status"
          defaultValue={params.status ?? ""}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Все</option>
          {Object.values(RouteStatus).map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="routes-city">
          Город
        </label>
        <select
          id="routes-city"
          name="cityId"
          defaultValue={params.cityId ?? ""}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Все</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="routes-visibility">
          Видимость
        </label>
        <select
          id="routes-visibility"
          name="visibility"
          defaultValue={params.visibility ?? ""}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Все</option>
          {Object.values(RouteVisibility).map((visibility) => (
            <option key={visibility} value={visibility}>{visibilityLabel(visibility)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="routes-author">
          Автор
        </label>
        <select
          id="routes-author"
          name="authorId"
          defaultValue={params.authorId ?? ""}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="">Все</option>
          <option value={EDITORIAL_AUTHOR_FILTER}>Редакция</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>{author.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" className="h-10">Применить</Button>
        <Button type="button" variant="outline" className="h-10" asChild>
          <Link href="/admin/content/routes">Сбросить</Link>
        </Button>
      </div>
    </form>
  );
}

function RoutesTable({
  routes,
  returnTo,
}: {
  routes: RouteListItem[];
  returnTo: string;
}) {
  if (routes.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Маршруты не найдены</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <TableContainer
        minWidthClassName="min-w-[1120px]"
        scrollLabel="Таблица маршрутов, прокручивается по горизонтали"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Видимость</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Точки</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Автор</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Обновлено</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {routes.map((route) => {
              const deletePreflight = routeDeletePreflight(route);
              const blockingItems = blockingDependencyItems(deletePreflight.dependencySummary);
              const lifecycleViewModel = buildAdminLifecycleViewModel({
                ...buildAdminRouteLifecycleInput({
                  status: route.status,
                  deletePreflight,
                }),
                navigationLinks: {
                  edit: true,
                  preview: true,
                  review: false,
                },
              });
              const authorLabel =
                route.author?.displayName?.trim() ||
                route.author?.email ||
                (route.authorId === null ? "Редакция" : "—");

              return (
                <tr key={route.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="max-w-[260px] truncate" title={route.title}>
                      {route.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <code className="text-xs">{route.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{route.city?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ContentLifecycleStatusBadge viewModel={lifecycleViewModel} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{visibilityLabel(route.visibility)}</td>
                  <td className="px-4 py-3 text-gray-600">{route._count.stops}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="max-w-[180px] truncate" title={authorLabel}>
                      {authorLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDistanceToNow(route.updatedAt, { addSuffix: true, locale: ru })}
                  </td>
                  <td className="px-4 py-3">
                    <ContentLifecycleActionsMenu
                      viewModel={lifecycleViewModel}
                      contentId={route.id}
                      contentType="route"
                      surface="admin"
                      links={{
                        edit: {
                          href: `/routes/${route.slug}/edit?returnTo=${encodeURIComponent(returnTo)}`,
                          label: "Редактировать в route flow",
                        },
                        preview: {
                          href: `/routes/${route.slug}`,
                          newTab: true,
                          label: "Открыть публичную страницу",
                        },
                      }}
                      deletePreflight={{
                        deleteDraft: {
                          blockedDialog: !deletePreflight.allowed
                            ? {
                                title: "Нельзя удалить маршрут",
                                description: deletePreflight.message,
                                items: blockingItems,
                              }
                            : null,
                        },
                      }}
                    />
                    <Link
                      href={`/admin/seo/pages/route/${route.id}`}
                      className="ml-2 inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                      SEO
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}

export default async function AdminRoutesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [routesResult, cities, authors] = await Promise.all([
    getRoutes(params),
    prisma.city.findMany({
      where: { isLegacyNonCity: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { routes: { some: {} } },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, displayName: true, email: true },
      take: 200,
    }),
  ]);
  const { items: routes, pagination } = routesResult;

  const authorOptions = authors.map((author) => ({
    id: author.id,
    label: author.displayName?.trim() || author.email,
  }));
  const returnTo = buildReturnTo(params);

  return (
    <div className="space-y-6 p-6 md:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-xl">Маршруты</h1>
          <p className="mt-1 text-sm text-gray-600">
            Нативные Route / RouteStop без новой сущности и без Prisma migration
          </p>
        </div>
        <Button asChild>
          <Link href="/routes/new">Создать маршрут</Link>
        </Button>
      </div>

      <RoutesFilters params={params} cities={cities} authors={authorOptions} />

      <Suspense fallback={<div>Загрузка…</div>}>
        <RoutesTable routes={routes} returnTo={returnTo} />
      </Suspense>

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        start={pagination.start}
        end={pagination.end}
        basePath="/admin/content/routes"
        params={params}
      />
    </div>
  );
}

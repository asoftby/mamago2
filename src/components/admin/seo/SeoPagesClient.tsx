"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Eye,
  Braces,
  Link2,
  Search,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SeoAdminPage,
  SeoPageIndexationStatus,
  SeoPageType,
} from "@/lib/admin/seo/seoPageTypes";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import { geographyLabelForPage } from "@/lib/admin/seo/geo";
import { SeoPagesEmptyState } from "./SeoPagesEmptyState";
import { SeoEntityDiagnosticsCard } from "./SeoEntityDiagnosticsCard";
import { Toggle } from "@/components/ui/Toggle";
import { TableContainer } from "@/components/ui/table";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type { AdminPaginationResult } from "@/lib/admin/pagination";
import { SEO_PAGES_PAGE_SIZES, type SeoPagesPageSize } from "@/lib/admin/seoNavConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_LABEL: Record<SeoPageType, string> = {
  preset: "Пресет",
  category: "Категория",
  generated: "Сгенерированная",
  landing: "Лендинг",
  event: "Событие",
  place: "Место",
  offer: "Оффер",
  route: "Маршрут",
  article: "Статья",
};

const STATUS_LABEL: Record<SeoPageIndexationStatus, string> = {
  indexed: "В индексе",
  noindex: "noindex",
  draft: "Черновик",
};

const STATUS_BADGE: Record<SeoPageIndexationStatus, string> = {
  indexed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  noindex: "bg-amber-50 text-amber-900 border-amber-200",
  draft: "bg-gray-100 text-gray-700 border-gray-200",
};

const BASE_PATH = "/admin/seo/pages";

function seoStateLabel(row: SeoAdminPage): string {
  const issues = row.entityDiagnostics?.issues.length ?? 0;
  if (issues > 0) return "Есть проблемы";
  if (!row.title?.trim() || !row.description?.trim()) return "Нужно заполнить";
  if (row.indexationStatus === "draft") return "Черновик";
  if (row.indexationStatus === "noindex") return "Скрыта";
  return "В порядке";
}

function isEntityRow(row: SeoAdminPage) {
  return row.id.startsWith("entity:");
}

interface SeoPagesClientProps {
  initialRows: SeoAdminPage[];
  pagination: AdminPaginationResult;
  filters: {
    q: string;
    type: SeoPageType | "all";
    indexation: SeoPageIndexationStatus | "all";
    pageSize: SeoPagesPageSize;
  };
  currentParams: Record<string, string | string[] | undefined>;
}

function getEntityId(row: SeoAdminPage): string | null {
  const snap = row.filtersSnapshot;
  if (snap && typeof snap === "object" && "entityId" in snap) {
    const v = (snap as { entityId?: unknown }).entityId;
    return typeof v === "string" && v.length > 0 ? v : null;
  }
  const parts = row.id.split(":");
  const last = parts[parts.length - 1];
  return last && last !== row.id ? last : null;
}

function seoSettingsHref(row: SeoAdminPage): string | null {
  const entityId = getEntityId(row);
  if (!entityId) return null;
  if (row.type === "event") return `/admin/seo/pages/event/${entityId}`;
  if (row.type === "place") return `/admin/seo/pages/place/${entityId}`;
  if (row.type === "offer") return `/admin/seo/pages/offer/${entityId}`;
  if (row.type === "route") return `/admin/seo/pages/route/${entityId}`;
  if (row.type === "article") return `/admin/seo/pages/article/${entityId}`;
  return null;
}

function toggleIndexationEndpoint(row: SeoAdminPage): string | null {
  const entityId = getEntityId(row);
  if (!entityId) return null;
  if (row.type === "event") return `/api/admin/seo/activity/${entityId}/toggle-indexation`;
  if (row.type === "place") return `/api/admin/seo/place/${entityId}/toggle-indexation`;
  if (row.type === "offer") return `/api/admin/seo/offer/${entityId}/toggle-indexation`;
  if (row.type === "route") return `/api/admin/seo/route/${entityId}/toggle-indexation`;
  if (row.type === "article") return `/api/admin/seo/article/${entityId}/toggle-indexation`;
  return null;
}

function schemaHref(row: SeoAdminPage): string | null {
  const entityId = getEntityId(row);
  if (!entityId) return null;
  if (row.type === "event") return `/admin/seo/pages/event/${entityId}/schema`;
  if (row.type === "place") return `/admin/seo/pages/place/${entityId}/schema`;
  if (row.type === "offer") return `/admin/seo/pages/offer/${entityId}/schema`;
  if (row.type === "route") return `/admin/seo/pages/route/${entityId}/schema`;
  if (row.type === "article") return `/admin/seo/pages/article/${entityId}/schema`;
  return null;
}

function redirectsHref(row: SeoAdminPage): string | null {
  const entityId = getEntityId(row);
  if (!entityId) return null;
  if (row.type === "event") return `/admin/seo/pages/event/${entityId}/redirects`;
  if (row.type === "place") return `/admin/seo/pages/place/${entityId}/redirects`;
  if (row.type === "offer") return `/admin/seo/pages/offer/${entityId}/redirects`;
  if (row.type === "route") return `/admin/seo/pages/route/${entityId}/redirects`;
  if (row.type === "article") return `/admin/seo/pages/article/${entityId}/redirects`;
  return null;
}

function isIndexFollowOn(row: SeoAdminPage): boolean {
  const r = (row.entityDiagnostics?.seoRobots ?? "").toLowerCase();
  return !r.includes("noindex");
}

function applyRobotsPatch(row: SeoAdminPage, index: boolean): SeoAdminPage {
  const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
  const nextStatus: SeoPageIndexationStatus =
    row.indexationStatus === "draft"
      ? "draft"
      : index
        ? "indexed"
        : "noindex";
  return {
    ...row,
    indexationStatus: nextStatus,
    isIndexable: index,
    entityDiagnostics: row.entityDiagnostics
      ? { ...row.entityDiagnostics, seoRobots }
      : row.entityDiagnostics,
  };
}

export function SeoPagesClient({
  initialRows,
  pagination,
  filters,
  currentParams,
}: SeoPagesClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [pendingIndexation, setPendingIndexation] = useState<{
    row: SeoAdminPage;
    nextIndex: boolean;
  } | null>(null);

  async function setIndexFollow(row: SeoAdminPage, index: boolean) {
    const endpoint = toggleIndexationEndpoint(row);
    if (!endpoint || busyRowId === row.id) return;
    const snapshot = row;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? applyRobotsPatch(r, index) : r)),
    );
    try {
      setBusyRowId(row.id);
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? snapshot : r)),
      );
    } finally {
      setBusyRowId(null);
    }
  }

  const emptyBecauseFilters =
    pagination.total === 0 &&
    (Boolean(filters.q) || filters.type !== "all" || filters.indexation !== "all");

  return (
    <div className="space-y-6">
      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Поиск
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="Название, URL или slug"
              className="h-9 pl-9"
            />
          </div>
        </div>
        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Тип
          </label>
          <select
            name="type"
            defaultValue={filters.type}
            className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="all">Все типы</option>
            <option value="event">Событие</option>
            <option value="place">Место</option>
            <option value="offer">Оффер</option>
            <option value="route">Маршрут</option>
            <option value="article">Статья</option>
          </select>
        </div>
        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Индексация
          </label>
          <select
            name="indexation"
            defaultValue={filters.indexation}
            className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="all">Все</option>
            <option value="indexed">В индексе</option>
            <option value="noindex">noindex</option>
            <option value="draft">Черновик</option>
          </select>
        </div>
        <div className="w-full min-w-[120px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            На странице
          </label>
          <select
            name="pageSize"
            defaultValue={String(filters.pageSize)}
            className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            {SEO_PAGES_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" className="h-9">
          Применить
        </Button>
      </form>

      {pagination.total === 0 && !emptyBecauseFilters ? (
        <SeoPagesEmptyState />
      ) : pagination.total === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-amber-50/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-900">
            Нет страниц по текущим фильтрам
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Измените поиск, фильтры или SEO-контекст
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
            <a href={BASE_PATH}>Сбросить фильтры</a>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <TableContainer
            minWidthClassName="min-w-[720px]"
            scrollLabel="Таблица страниц SEO, прокручивается по горизонтали"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-8 px-1 py-3" aria-hidden />
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Страница
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Тип
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    География
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    SEO-состояние
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Индексация
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Проблемы
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const settingsHref = seoSettingsHref(row);
                  const canSeoSettings = Boolean(settingsHref);
                  const issues = row.entityDiagnostics?.issues.length ?? 0;
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-gray-50/80">
                        <td className="px-1 py-2 align-middle">
                          {isEntityRow(row) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              aria-expanded={expandedRowId === row.id}
                              aria-label={
                                expandedRowId === row.id
                                  ? "Свернуть детали"
                                  : "Показать детали"
                              }
                              onClick={() =>
                                setExpandedRowId((id) =>
                                  id === row.id ? null : row.id,
                                )
                              }
                            >
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  expandedRowId === row.id && "rotate-90",
                                )}
                              />
                            </Button>
                          ) : (
                            <span className="inline-block w-8" />
                          )}
                        </td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="line-clamp-2 font-medium text-gray-900" title={row.h1}>
                            {row.h1 || row.title}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500" title={row.path}>
                            {row.path}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant="outline" className="font-normal">
                            {TYPE_LABEL[row.type]}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {geographyLabelForPage(row)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {seoStateLabel(row)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                              STATUS_BADGE[row.indexationStatus],
                            )}
                          >
                            {STATUS_LABEL[row.indexationStatus]}
                          </span>
                        </td>
                        <td className="max-w-[140px] px-4 py-3 text-xs">
                          {row.entityDiagnostics ? (
                            issues > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {issues}
                              </span>
                            ) : (
                              <span className="text-emerald-700">Нет</span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-600 hover:text-gray-900"
                              aria-label="Открыть публичную страницу"
                              title="Просмотр"
                              onClick={() => router.push(row.path)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-600 hover:text-gray-900 disabled:opacity-40"
                              aria-label="Редактировать SEO"
                              title={
                                canSeoSettings
                                  ? "Редактировать SEO"
                                  : "Только для сущностей из БД"
                              }
                              disabled={!canSeoSettings}
                              onClick={() => {
                                if (settingsHref) router.push(settingsHref);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedRowId === row.id && isEntityRow(row) ? (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="space-y-4">
                              {row.entityDiagnostics ? (
                                <SeoEntityDiagnosticsCard
                                  d={row.entityDiagnostics}
                                  variant="compact"
                                  canonicalUrl={row.canonical}
                                />
                              ) : null}
                              <div className="flex flex-col gap-4 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={!schemaHref(row)}
                                    onClick={() => {
                                      const h = schemaHref(row);
                                      if (h) router.push(h);
                                    }}
                                  >
                                    <Braces className="h-4 w-4" />
                                    schema.org
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={!redirectsHref(row)}
                                    onClick={() => {
                                      const h = redirectsHref(row);
                                      if (h) router.push(h);
                                    }}
                                  >
                                    <Link2 className="h-4 w-4" />
                                    Редиректы
                                  </Button>
                                </div>
                                {toggleIndexationEndpoint(row) ? (
                                  <div className="flex items-center gap-3 sm:justify-end">
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-gray-800">
                                        Индексация
                                      </p>
                                      <p className="text-[11px] text-amber-800">
                                        Опасное действие — требуется подтверждение
                                      </p>
                                    </div>
                                    <Toggle
                                      checked={isIndexFollowOn(row)}
                                      disabled={busyRowId === row.id}
                                      aria-label="Индексация: index или noindex"
                                      onChange={(next) =>
                                        setPendingIndexation({
                                          row,
                                          nextIndex: next,
                                        })
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </TableContainer>
          <div className="border-t border-gray-100 px-4 py-3">
            <AdminPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              start={pagination.start}
              end={pagination.end}
              basePath={BASE_PATH}
              params={currentParams}
            />
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingIndexation)}
        onOpenChange={(open) => {
          if (!open) setPendingIndexation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить индексацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Изменение индексации может привести к исчезновению страницы из
              Google и Яндекса.
              {pendingIndexation
                ? ` Страница: «${pendingIndexation.row.h1 || pendingIndexation.row.title}».`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!pendingIndexation) return;
                const { row, nextIndex } = pendingIndexation;
                setPendingIndexation(null);
                void setIndexFollow(row, nextIndex);
              }}
            >
              Изменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

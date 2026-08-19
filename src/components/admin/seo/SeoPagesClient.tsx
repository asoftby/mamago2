"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SeoAdminPage,
  SeoPageIndexationStatus,
  SeoPageSection,
  SeoPageType,
} from "@/lib/admin/seo/seoPageTypes";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import { SeoPagesEmptyState } from "./SeoPagesEmptyState";
import { SeoEntityDiagnosticsCard } from "./SeoEntityDiagnosticsCard";
import { Toggle } from "@/components/ui/Toggle";
import { TableContainer } from "@/components/ui/table";

const TYPE_LABEL: Record<SeoPageType, string> = {
  preset: "Preset",
  category: "Category",
  generated: "Generated",
  landing: "Landing",
  event: "Event",
  place: "Place",
  offer: "Offer",
  route: "Route",
  article: "Article",
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

const SECTION_LABEL: Record<SeoPageSection, string> = {
  kuda: "Куда",
  zanyatiya: "Занятия",
  events: "События",
  journal: "Журнал",
  routes: "Маршруты",
  birthday: "Дни рождения",
  other: "Прочее",
};

const SECTION_OPTIONS: { value: SeoPageSection | "all"; label: string }[] = [
  { value: "all", label: "Все разделы" },
  { value: "kuda", label: "Куда" },
  { value: "zanyatiya", label: "Занятия" },
  { value: "events", label: "События" },
  { value: "journal", label: "Журнал" },
  { value: "routes", label: "Маршруты" },
  { value: "birthday", label: "Дни рождения" },
  { value: "other", label: "Другое" },
];

function matchesSearch(row: SeoAdminPage, q: string) {
  if (!q.trim()) return true;
  const x = q.trim().toLowerCase();
  const slug = row.path.split("/").filter(Boolean).pop() ?? "";
  const d = row.entityDiagnostics;
  return (
    row.path.toLowerCase().includes(x) ||
    row.h1.toLowerCase().includes(x) ||
    row.title.toLowerCase().includes(x) ||
    slug.toLowerCase().includes(x) ||
    row.id.toLowerCase().includes(x) ||
    (d &&
      (d.entityId.toLowerCase().includes(x) ||
        (d.slug ?? "").toLowerCase().includes(x) ||
        d.entityTitle.toLowerCase().includes(x) ||
        (d.citySlug ?? "").toLowerCase().includes(x)))
  );
}

function isEntityRow(row: SeoAdminPage) {
  return row.id.startsWith("entity:");
}

interface SeoPagesClientProps {
  initialRows: SeoAdminPage[];
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

export function SeoPagesClient({ initialRows }: SeoPagesClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SeoPageType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    SeoPageIndexationStatus | "all"
  >("all");
  const [sectionFilter, setSectionFilter] = useState<
    SeoPageSection | "all"
  >("all");
  const [entitiesOnly, setEntitiesOnly] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesSearch(row, query)) return false;
      if (entitiesOnly && !isEntityRow(row)) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (statusFilter !== "all" && row.indexationStatus !== statusFilter)
        return false;
      if (sectionFilter !== "all" && row.section !== sectionFilter)
        return false;
      return true;
    });
  }, [rows, query, typeFilter, statusFilter, sectionFilter, entitiesOnly]);

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
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? snapshot : r)),
      );
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Поиск
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="URL, slug, H1 или title"
              className="h-9 pl-9"
            />
          </div>
        </div>
        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Тип
          </label>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as SeoPageType | "all")}
          >
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="preset">preset</SelectItem>
              <SelectItem value="category">category</SelectItem>
              <SelectItem value="generated">generated</SelectItem>
              <SelectItem value="landing">landing</SelectItem>
              <SelectItem value="event">event</SelectItem>
              <SelectItem value="place">place</SelectItem>
              <SelectItem value="offer">offer</SelectItem>
              <SelectItem value="route">route</SelectItem>
              <SelectItem value="article">article</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Статус
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as SeoPageIndexationStatus | "all")
            }
          >
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="indexed">indexed</SelectItem>
              <SelectItem value="noindex">noindex</SelectItem>
              <SelectItem value="draft">draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-[160px] sm:w-auto">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Раздел
          </label>
          <Select
            value={sectionFilter}
            onValueChange={(v) =>
              setSectionFilter(v as SeoPageSection | "all")
            }
          >
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="Раздел" />
            </SelectTrigger>
            <SelectContent>
              {SECTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={entitiesOnly}
              onChange={(e) => setEntitiesOnly(e.target.checked)}
            />
            Только сущности (БД)
          </label>
        </div>
      </div>

      {initialRows.length === 0 ? (
        <SeoPagesEmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-amber-50/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-900">
            Нет строк по текущим фильтрам
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Измените поиск или сбросьте фильтры
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
              setStatusFilter("all");
              setSectionFilter("all");
              setEntitiesOnly(false);
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <TableContainer
            minWidthClassName="min-w-[920px]"
            scrollLabel="Таблица SEO-страниц, прокручивается по горизонтали"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-8 px-1 py-3" aria-hidden />
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    URL
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Slug (БД)
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    H1
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Section
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Indexation
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Диагностика
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-700">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => {
                  const settingsHref = seoSettingsHref(row);
                  const canSeoSettings = Boolean(settingsHref);
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
                                  : "Показать диагностику и доп. действия"
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
                        <td className="max-w-[200px] px-4 py-3 font-mono text-xs text-gray-800">
                          <span className="break-all">{row.path}</span>
                        </td>
                        <td className="max-w-[120px] px-4 py-3 font-mono text-xs text-gray-700">
                          <span
                            className="line-clamp-2 break-all"
                            title={row.entityDiagnostics?.slug ?? ""}
                          >
                            {row.entityDiagnostics?.slug ?? "—"}
                          </span>
                        </td>
                        <td className="max-w-[180px] px-4 py-3 text-gray-800">
                          <span className="line-clamp-2" title={row.h1}>
                            {row.h1}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant="outline" className="font-normal">
                            {TYPE_LABEL[row.type]}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {SECTION_LABEL[row.section] ?? row.section}
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
                            row.entityDiagnostics.issues.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {row.entityDiagnostics.issues.length} проблем
                              </span>
                            ) : (
                              <span className="text-emerald-700">OK</span>
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
                              aria-label="Preview — открыть public страницу"
                              title="Preview"
                              onClick={() => router.push(row.path)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-600 hover:text-gray-900 disabled:opacity-40"
                              aria-label="SEO settings"
                              title={
                                canSeoSettings
                                  ? "SEO settings"
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
                          <td colSpan={9} className="px-4 py-4">
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
                                    Schema
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
                                    Redirects
                                  </Button>
                                </div>
                                {toggleIndexationEndpoint(row) ? (
                                  <div className="flex items-center gap-3 sm:justify-end">
                                    <span className="text-sm text-gray-700">
                                      Индексация
                                    </span>
                                    <Toggle
                                      checked={isIndexFollowOn(row)}
                                      disabled={busyRowId === row.id}
                                      aria-label="Индексация: index или noindex"
                                      onChange={(next) =>
                                        setIndexFollow(row, next)
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
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            Показано {filtered.length} из {initialRows.length}
          </div>
        </div>
      )}
    </div>
  );
}

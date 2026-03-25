"use client";

import { useMemo, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Eye,
  ToggleLeft,
  Braces,
  Link2,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  SeoAdminPage,
  SeoPageIndexationStatus,
  SeoPageSection,
  SeoPageType,
} from "@/lib/admin/seo/seoPageTypes";
import { SeoPagesEmptyState } from "./SeoPagesEmptyState";

const TYPE_LABEL: Record<SeoPageType, string> = {
  preset: "Preset",
  category: "Category",
  generated: "Generated",
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
  journal: "Журнал",
  routes: "Маршруты",
  birthday: "Дни рождения",
  other: "Прочее",
};

const SECTION_OPTIONS: { value: SeoPageSection | "all"; label: string }[] = [
  { value: "all", label: "Все разделы" },
  { value: "kuda", label: "Куда" },
  { value: "zanyatiya", label: "Занятия" },
  { value: "journal", label: "Журнал" },
  { value: "routes", label: "Маршруты" },
  { value: "birthday", label: "Дни рождения" },
  { value: "other", label: "Другое" },
];

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

function matchesSearch(row: SeoAdminPage, q: string) {
  if (!q.trim()) return true;
  const x = q.trim().toLowerCase();
  const slug = row.path.split("/").filter(Boolean).pop() ?? "";
  return (
    row.path.toLowerCase().includes(x) ||
    row.h1.toLowerCase().includes(x) ||
    row.title.toLowerCase().includes(x) ||
    slug.toLowerCase().includes(x)
  );
}

interface SeoPagesClientProps {
  initialRows: SeoAdminPage[];
}

export function SeoPagesClient({ initialRows }: SeoPagesClientProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SeoPageType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    SeoPageIndexationStatus | "all"
  >("all");
  const [sectionFilter, setSectionFilter] = useState<
    SeoPageSection | "all"
  >("all");

  const filtered = useMemo(() => {
    return initialRows.filter((row) => {
      if (!matchesSearch(row, query)) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (statusFilter !== "all" && row.indexationStatus !== statusFilter)
        return false;
      if (sectionFilter !== "all" && row.section !== sectionFilter)
        return false;
      return true;
    });
  }, [initialRows, query, typeFilter, statusFilter, sectionFilter]);

  return (
    <div className="space-y-6">
      {/* Filter bar */}
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
              className="pl-9"
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
            <SelectTrigger>
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="preset">preset</SelectItem>
              <SelectItem value="category">category</SelectItem>
              <SelectItem value="generated">generated</SelectItem>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    URL
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
                    Canonical
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                    Updated
                  </th>
                  <th className="w-12 px-2 py-3 font-semibold text-gray-700">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80">
                    <td className="max-w-[220px] px-4 py-3 font-mono text-xs text-gray-800">
                      <span className="break-all">{row.path}</span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-gray-800">
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
                    <td
                      className="max-w-[180px] px-4 py-3 font-mono text-xs text-gray-600"
                      title={row.canonical ?? ""}
                    >
                      {row.canonical ? truncate(row.canonical, 36) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {format(new Date(row.updatedAt), "d MMM yyyy, HH:mm", {
                        locale: ru,
                      })}
                    </td>
                    <td className="px-1 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Действия"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 shrink-0" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Eye className="h-4 w-4 shrink-0" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <ToggleLeft className="h-4 w-4 shrink-0" />
                            Toggle indexation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Braces className="h-4 w-4 shrink-0" />
                            View schema
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 shrink-0" />
                            View redirects
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            Показано {filtered.length} из {initialRows.length}
          </div>
        </div>
      )}
    </div>
  );
}

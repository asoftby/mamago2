"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { AdminPagination, type AdminPaginationProps } from "@/components/admin/AdminPagination";
import { buildAdminPageHref } from "@/lib/admin/pagination";
import type {
  ManualRedirect,
  RedirectDisposition,
  RedirectRule,
} from "@/lib/admin/seo/redirectCenterTypes";

const BASE_PATH = "/admin/seo/redirects";

const DISPOSITION_LABEL: Record<RedirectDisposition, string> = {
  EXACT_REDIRECT: "Exact",
  VALID_HUB_REMAP: "Hub",
  P1_START_OR_CONTAINS: "P1 (contains)",
  INVALID_TARGET: "Needs review",
  COLLISION: "Collision",
  CHAIN: "Chain",
  LOOP: "Loop",
};

const DISPOSITION_BADGE_CLASS: Record<RedirectDisposition, string> = {
  EXACT_REDIRECT: "border-emerald-200 bg-emerald-50 text-emerald-900",
  VALID_HUB_REMAP: "border-blue-200 bg-blue-50 text-blue-900",
  P1_START_OR_CONTAINS: "border-amber-200 bg-amber-50 text-amber-900",
  INVALID_TARGET: "border-rose-200 bg-rose-50 text-rose-900",
  COLLISION: "border-rose-300 bg-rose-100 text-rose-950",
  CHAIN: "border-orange-200 bg-orange-50 text-orange-900",
  LOOP: "border-red-300 bg-red-100 text-red-950",
};

const FILTER_OPTIONS: Array<{ value: RedirectDisposition | "ALL"; label: string }> = [
  { value: "ALL", label: "Все" },
  { value: "EXACT_REDIRECT", label: "Exact" },
  { value: "VALID_HUB_REMAP", label: "Hub" },
  { value: "P1_START_OR_CONTAINS", label: "P1 (contains)" },
  { value: "INVALID_TARGET", label: "Needs review" },
  { value: "COLLISION", label: "Collision" },
  { value: "CHAIN", label: "Chain" },
  { value: "LOOP", label: "Loop" },
];

interface RedirectCenterSummary {
  systemTotal: number;
  manualCount: number;
  counts: Record<RedirectDisposition, number>;
}

interface RedirectCenterClientProps {
  automatic: RedirectRule[];
  automaticPagination: Omit<AdminPaginationProps, "basePath" | "params" | "className">;
  manual: ManualRedirect[];
  summary: RedirectCenterSummary;
  currentSearch: string;
  currentFilter: RedirectDisposition | "ALL";
  currentParams: Record<string, string | string[] | undefined>;
}

export function RedirectCenterClient({
  automatic,
  automaticPagination,
  manual: initialManual,
  summary,
  currentSearch,
  currentFilter,
  currentParams,
}: RedirectCenterClientProps) {
  const [tab, setTab] = useState("automatic");
  const [searchDraft, setSearchDraft] = useState(currentSearch);

  const filterHref = (value: RedirectDisposition | "ALL") => {
    const params = { ...currentParams, filter: value === "ALL" ? undefined : value, page: undefined };
    return buildAdminPageHref(BASE_PATH, params, 1);
  };

  const collisionsChainsLoops =
    summary.counts.COLLISION + summary.counts.CHAIN + summary.counts.LOOP;

  return (
    <div className="space-y-6">
      <SeoPageHeader
        title="Redirects"
        subtitle="Системные (миграционные) редиректы — read-only; ручные редиректы — в отдельной вкладке"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <SummaryCard label="System / Migration" value={summary.systemTotal} />
        <SummaryCard label="Manual" value={summary.manualCount} />
        <SummaryCard label="Exact" value={summary.counts.EXACT_REDIRECT} tone="emerald" />
        <SummaryCard label="Hub" value={summary.counts.VALID_HUB_REMAP} tone="blue" />
        <SummaryCard label="P1 (contains)" value={summary.counts.P1_START_OR_CONTAINS} tone="amber" />
        <SummaryCard label="Needs review" value={summary.counts.INVALID_TARGET} tone="rose" />
        <SummaryCard label="Collisions" value={summary.counts.COLLISION} tone="rose" />
        <SummaryCard label="Loops / chains" value={collisionsChainsLoops - summary.counts.COLLISION} tone="rose" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:grid-cols-2">
          <TabsTrigger value="automatic" className="justify-center py-2.5">
            System / Migration
            <span className="ml-1.5 text-xs text-muted-foreground">({summary.systemTotal})</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="justify-center py-2.5">
            Manual
            <span className="ml-1.5 text-xs text-muted-foreground">({initialManual.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automatic" className="mt-6 space-y-3">
          <p className="text-sm text-gray-600">
            Источник — build-time migration manifest (scripts/data/wp-redirect-map.json,
            893 строки), тот же, что использует runtime-конфигурация редиректов
            (next.config.ts). Редактирование и удаление недоступны — только чтение.
          </p>

          <form
            method="get"
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                name="q"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Поиск по source или destination…"
                className="pl-8"
              />
            </div>
            {currentFilter !== "ALL" ? <input type="hidden" name="filter" value={currentFilter} /> : null}
            <Button type="submit" variant="outline">
              Найти
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <Link key={opt.value} href={filterHref(opt.value)} scroll={false}>
                <Badge
                  variant={currentFilter === opt.value ? "default" : "secondary"}
                  className="cursor-pointer font-mono text-[11px]"
                >
                  {opt.label}
                </Badge>
              </Link>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50/90">
                    <th className="px-4 py-3 font-semibold text-gray-800">Source URL</th>
                    <th className="px-4 py-3 font-semibold text-gray-800">Destination URL</th>
                    <th className="px-4 py-3 font-semibold text-gray-800">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-800">Source type</th>
                    <th className="px-4 py-3 font-semibold text-gray-800">Disposition</th>
                    <th className="px-4 py-3 font-semibold text-gray-800">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {automatic.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        Ничего не найдено по текущему поиску/фильтру.
                      </td>
                    </tr>
                  ) : (
                    automatic.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="max-w-[220px] px-4 py-3 font-mono text-xs text-gray-800">
                          <span className="break-all">{row.fromUrl}</span>
                        </td>
                        <td className="max-w-[220px] px-4 py-3 font-mono text-xs text-gray-800">
                          <span className="break-all">{row.toUrl}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">301</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                            <Lock className="h-3 w-3" aria-hidden />
                            Системный · Только чтение
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.disposition ? (
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-xs font-medium",
                                DISPOSITION_BADGE_CLASS[row.disposition],
                              )}
                            >
                              {DISPOSITION_LABEL[row.disposition]}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {row.disposition === "INVALID_TARGET"
                            ? "Needs review"
                            : row.disposition === "COLLISION" ||
                                row.disposition === "CHAIN" ||
                                row.disposition === "LOOP"
                              ? DISPOSITION_LABEL[row.disposition]
                              : "OK"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AdminPagination
            page={automaticPagination.page}
            totalPages={automaticPagination.totalPages}
            total={automaticPagination.total}
            start={automaticPagination.start}
            end={automaticPagination.end}
            basePath={BASE_PATH}
            params={currentParams}
          />
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            Создание и изменение ручных правил пока недоступно: постоянное
            backend-хранилище и create/update flow не подключены. Это P1, а не
            фиктивное сохранение в браузере.
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Ручные правила</h2>
            {initialManual.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center text-sm text-gray-500">
                Ручных редиректов пока нет
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-slate-50/90">
                        <th className="px-4 py-3 font-semibold text-gray-800">From</th>
                        <th className="px-4 py-3 font-semibold text-gray-800">To</th>
                        <th className="px-4 py-3 font-semibold text-gray-800">Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-800">Note</th>
                        <th className="px-4 py-3 font-semibold text-gray-800">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-800">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {initialManual.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">{row.from}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">{row.to}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.redirectType}</td>
                          <td className="max-w-[200px] px-4 py-3 text-xs text-gray-600">{row.note ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.status}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{row.updatedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "blue"
        ? "text-blue-700"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "rose"
            ? "text-rose-700"
            : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { PublicationAnalyticsDrawer } from "@/components/analytics/PublicationAnalyticsDrawer";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import type { BusinessPublicationRow } from "@/server/services/business/businessWorkspace.service";

const DATE_RANGE_OPTIONS: Array<{ value: AnalyticsOverviewDateRange; label: string }> = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "1y", label: "Год" },
];

const ENTITY_TYPE_LABEL_RU: Record<string, string> = {
  EVENT: "Событие",
  OFFER: "Предложение",
  PLACE: "Место",
};

type ListResponse = {
  publications: BusinessPublicationRow[];
  range: { start: string; end: string };
};

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Загрузка аналитики">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-100" />
      ))}
    </div>
  );
}

export function BusinessAnalyticsClient() {
  const [dateRange, setDateRange] = useState<AnalyticsOverviewDateRange>("30d");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    entityType: string;
    entityId: string;
    title: string;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/business/analytics/publications?dateRange=${dateRange}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetails = (row: BusinessPublicationRow) => {
    setSelected({ entityType: row.entityType, entityId: row.entityId, title: row.title });
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDateRange(opt.value)}
            className={
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
              (dateRange === opt.value
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : data && data.publications.length === 0 ? (
        <BusinessEmptyState
          icon={<BarChart3 className="h-7 w-7" />}
          title="Пока нет данных"
          description="Как только у ваших событий, предложений или мест появятся показы и открытия, здесь будет видна реальная статистика по каждой публикации."
        />
      ) : data ? (
        <div className="space-y-3">
          {data.publications.map((row) => (
            <button
              key={`${row.entityType}:${row.entityId}`}
              type="button"
              onClick={() => openDetails(row)}
              className="flex w-full flex-col gap-4 rounded-[24px] border border-stone-200/90 bg-stone-50/70 p-4 text-left transition hover:border-stone-300 hover:bg-white md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BusinessChip tone="muted" size="compact">
                    {ENTITY_TYPE_LABEL_RU[row.entityType] ?? row.entityType}
                  </BusinessChip>
                  <span className="text-xs text-stone-400">{row.status}</span>
                </div>
                <p className="mt-2 truncate text-base font-semibold text-stone-950 md:text-lg">
                  {row.title}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <BusinessChip>Показы: {row.metrics.views}</BusinessChip>
                <BusinessChip>Открытия: {row.metrics.opens}</BusinessChip>
                <BusinessChip>Сохранения: {row.metrics.saves}</BusinessChip>
                <BusinessChip>В план: {row.metrics.planAdds}</BusinessChip>
                <BusinessChip tone="accent">Целевые действия: {row.metrics.ctaClicks}</BusinessChip>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <PublicationAnalyticsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        publication={selected}
        filters={{ dateRange, city: "" }}
        fetchBasePath="/api/business/analytics/publications"
      />
    </div>
  );
}

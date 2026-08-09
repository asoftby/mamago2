"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type { PublicationAnalyticsDetail } from "@/lib/analytics/analyticsContentPerformanceTypes";

interface PublicationAnalyticsDetailsProps {
  entityType: string;
  entityId: string;
  title: string;
  filters: Pick<AnalyticsOverviewFilters, "dateRange" | "city">;
  /** e.g. "/api/admin/analytics/content-performance" or "/api/business/analytics/publications" — the shared drill-down endpoint shape is `${fetchBasePath}/${entityType}/${entityId}`. */
  fetchBasePath: string;
}

const ENTITY_TYPE_LABEL_RU: Record<string, string> = {
  EVENT: "Событие",
  PLACE: "Место",
  OFFER: "Предложение",
  ARTICLE: "Статья",
  ROUTE: "Маршрут",
};

function pct(x: number | null): string {
  if (x == null) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function Skeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Загрузка отчёта">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-[14px] font-medium text-gray-700">Не удалось загрузить отчёт</p>
      <p className="font-mono text-[12px] text-gray-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-lg border border-gray-200 px-4 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        Повторить
      </button>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
      <p className="text-[20px] font-semibold tabular-nums text-gray-900">
        {value.toLocaleString("ru-RU")}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-1.5 text-[13px] last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="tabular-nums font-medium text-gray-900">{pct(value)}</span>
    </div>
  );
}

/**
 * Отчёт по одной публикации — загружается lazy только после открытия drawer.
 * Общий компонент для Admin (Content Performance) и Business
 * (/business/analytics) — оба используют один и тот же bounded aggregate
 * (getPublicationAnalyticsDetail) через разные, RBAC/ownership-защищённые
 * endpoints (fetchBasePath), без второй реализации расчёта или CTA-группировки.
 */
export function PublicationAnalyticsDetails({
  entityType,
  entityId,
  title,
  filters,
  fetchBasePath,
}: PublicationAnalyticsDetailsProps) {
  const [data, setData] = useState<PublicationAnalyticsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const qs = new URLSearchParams({ dateRange: filters.dateRange, city: filters.city });
        const res = await fetch(
          `${fetchBasePath}/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?${qs}`,
          { credentials: "include" },
        );
        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          setError("Недостаточно прав для просмотра отчёта");
          return;
        }
        if (res.status === 404) {
          setError("Публикация не найдена");
          return;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setError(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as PublicationAnalyticsDetail;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Сеть недоступна");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, filters.dateRange, filters.city, fetchBasePath, retryKey]);

  return (
    <div className={cn("space-y-4 p-4", loading && data && "opacity-60 pointer-events-none")}>
      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : data ? (
        <>
          {/* Заголовок публикации */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="truncate text-[14px] font-semibold text-gray-900">{title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
              <span>{ENTITY_TYPE_LABEL_RU[data.entityType] ?? data.entityType}</span>
              {data.cityName && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{data.cityName}</span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span>
                {formatDate(data.range.start)} — {formatDate(data.range.end)}
              </span>
            </p>
          </div>

          {/* Ключевые метрики */}
          <div className="grid grid-cols-5 gap-2">
            <MetricTile label="Показы" value={data.metrics.impressions} />
            <MetricTile label="Открытия" value={data.metrics.opens} />
            <MetricTile label="Сохранили" value={data.metrics.saves} />
            <MetricTile label="В план" value={data.metrics.planAdds} />
            <MetricTile label="CTA" value={data.metrics.ctaClicks} />
          </div>

          {/* Конверсия */}
          <section className="rounded-xl border border-gray-100 p-3">
            <h3 className="text-[12px] font-semibold text-gray-900">Конверсия</h3>
            <div className="mt-1">
              <RateRow label="Открытие / показ" value={data.rates.openRate} />
              <RateRow label="Сохранение / открытие" value={data.rates.saveRate} />
              <RateRow label="В план / сохранение" value={data.rates.planRate} />
              <RateRow label="CTA / открытие" value={data.rates.ctaRateVsOpens} />
            </div>
          </section>

          {/* Целевые действия (CTA breakdown) */}
          <section className="rounded-xl border border-gray-100 p-3">
            <h3 className="text-[12px] font-semibold text-gray-900">
              Целевые действия — {data.metrics.ctaClicks.toLocaleString("ru-RU")}
            </h3>
            {data.ctaBreakdown.length === 0 ? (
              <p className="mt-2 text-[12px] text-gray-400">
                Целевых действий за выбранный период не зафиксировано
              </p>
            ) : (
              <ul className="mt-1">
                {data.ctaBreakdown.map((row) => (
                  <li
                    key={row.action ?? "(none)"}
                    className="flex items-center justify-between border-b border-gray-50 py-1.5 text-[13px] last:border-0"
                  >
                    <span className="text-gray-700">{row.label}</span>
                    <span className="tabular-nums font-medium text-gray-900">
                      {row.count.toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <p className="font-mono text-[10px] text-gray-400">предупреждение: {error}</p>
          )}
        </>
      ) : null}
    </div>
  );
}

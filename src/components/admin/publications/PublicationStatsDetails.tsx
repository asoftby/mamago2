"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PUBLICATION_STATS_PERIOD,
  PUBLICATION_STATS_PERIOD_LABEL_RU,
  type PublicationStatsPeriod,
} from "@/lib/publication-stats/period";
import type { PublicationStatsPayload } from "@/lib/publication-stats/types";
import { PublicationStatsPeriodSwitch } from "@/components/publication-stats/PublicationStatsPeriodSwitch";
import { PublicationStatsSections } from "@/components/publication-stats/PublicationStatsSections";
import { PublicationStatsHeader } from "@/components/publication-stats/PublicationStatsHeader";

interface PublicationStatsDetailsProps {
  entityId: string;
  path: string;
}

function Skeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Загрузка статистики">
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
      <p className="text-[14px] font-medium text-gray-700">Не удалось загрузить статистику</p>
      <p className="text-[12px] text-gray-400 font-mono">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-lg border border-gray-200 px-4 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Повторить
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <p className="text-[14px] font-medium text-gray-600">Данных пока нет</p>
      <p className="text-[12px] text-gray-400">
        Статистика появится после того, как публикация наберёт просмотры
      </p>
    </div>
  );
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Детальная статистика публикации — загружается lazy только после открытия drawer.
 * Переиспользует все существующие секции из PublicationStatsSections.
 */
export function PublicationStatsDetails({ entityId, path }: PublicationStatsDetailsProps) {
  const [period, setPeriod] = useState<PublicationStatsPeriod>(DEFAULT_PUBLICATION_STATS_PERIOD);
  const [data, setData] = useState<PublicationStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const qs = new URLSearchParams({ path, period });
        const res = await fetch(
          `/api/publication-stats/${encodeURIComponent(entityId)}?${qs}`,
          { credentials: "include" },
        );
        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          setError("Недостаточно прав для просмотра статистики");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setError(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as PublicationStatsPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Сеть недоступна");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [entityId, path, period, retryKey]);

  const isEmpty = data && (data as PublicationStatsPayload & { empty?: boolean }).empty === true;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Period switch */}
      <div className="shrink-0 border-b border-gray-100 px-4 py-3">
        <PublicationStatsPeriodSwitch
          value={period}
          onChange={setPeriod}
          disabled={loading}
          className="w-full"
        />
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : isEmpty ? (
          <EmptyState />
        ) : data ? (
          <div className={cn("p-4 space-y-4", loading && "opacity-60 pointer-events-none")}>
            {/* Header meta */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <PublicationStatsHeader
                header={data.header}
                periodLabelRu={PUBLICATION_STATS_PERIOD_LABEL_RU[period]}
                statsUpdatedAtDisplay={loading ? "…" : formatUpdatedAt(data.header.statsUpdatedAt)}
              />
            </div>

            {/* All sections */}
            <PublicationStatsSections payload={data} />

            {error && (
              <p className="font-mono text-[10px] text-gray-400">предупреждение: {error}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

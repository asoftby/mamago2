"use client";

import { useEffect, useState } from "react";
import { minskDateKey, type BusinessStatsPeriod } from "@/lib/business/publicationAnalyticsRange";

import {
  BarChart3,
  CalendarDays,
  Lightbulb,
  MousePointerClick,
  Save,
  Target,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PromotionPeriod } from "@/server/services/promotion/boostPerformance.service";
import { StatisticsRangeCalendar } from "./StatisticsRangeCalendar";
import { PromotionResultsSection } from "./PromotionResultsSection";

export type PublicationMetrics = {
  views: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
};

interface PublicationStatisticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityLabel: string;
  /** When entity identity is present, load real period-filtered analytics from owned-publication API. */
  entityType?: "EVENT" | "OFFER" | "PLACE";
  entityId?: string;
  publicationCreatedAt?: Date | string;
  metrics?: PublicationMetrics | null;
  promotionPeriods?: PromotionPeriod[];
  repeatPromotionHref?: string;
}

const ZERO_METRICS: PublicationMetrics = {
  views: 0,
  saves: 0,
  planAdds: 0,
  ctaClicks: 0,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function percent(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-500">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-2xl font-semibold text-stone-950">{value}</div>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

export function PublicationStatisticsDialog({
  open,
  onOpenChange,
  title,
  entityLabel,
  entityType,
  entityId,
  publicationCreatedAt,
  metrics,
  promotionPeriods = [],
  repeatPromotionHref,
}: PublicationStatisticsDialogProps) {
  const periodized = Boolean(entityType && entityId);
  const [period, setPeriod] = useState<BusinessStatsPeriod>("today");
  const minDate = publicationCreatedAt ? minskDateKey(new Date(publicationCreatedAt)) : "2000-01-01";
  const todayDate = minskDateKey(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [fromDate, setFromDate] = useState(minDate);
  const [toDate, setToDate] = useState(todayDate);
  const customValid = period !== "custom"
    || (fromDate >= minDate && fromDate <= toDate && toDate <= todayDate);
  const periodKey = [entityType, entityId, period, fromDate, toDate].join("|");
  const [result, setResult] = useState<{ key: string; metrics: PublicationMetrics } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !periodized || !entityType || !entityId || !customValid) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ period });
        if (period === "custom") {
          qs.set("from", fromDate);
          qs.set("to", toDate);
        }
        const response = await fetch(
          "/api/business/analytics/publications/" + encodeURIComponent(entityType!) +
          "/" + encodeURIComponent(entityId!) + "?" + qs.toString(),
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить статистику");
        }
        const body = await response.json() as {
          metrics: { impressions: number; saves: number; planAdds: number; ctaClicks: number };
        };
        if (!controller.signal.aborted) {
          setResult({
            key: periodKey,
            metrics: {
              views: body.metrics.impressions,
              saves: body.metrics.saves,
              planAdds: body.metrics.planAdds,
              ctaClicks: body.metrics.ctaClicks,
            },
          });
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить статистику");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, periodized, entityType, entityId, period, fromDate, toDate, customValid, periodKey]);

  // Do not display old all-time metrics while a new period is loading.
  const data = periodized
    ? (result?.key === periodKey ? result.metrics : null)
    : (metrics ?? ZERO_METRICS);
  const ctr = data && data.views > 0 ? (data.ctaClicks / data.views) * 100 : 0;
  const periods: Array<{ id: BusinessStatsPeriod; label: string }> = [
    { id: "today", label: "Сегодня" },
    { id: "yesterday", label: "Вчера" },
    { id: "week", label: "Неделя" },
    { id: "month", label: "Месяц" },
    { id: "custom", label: "Свой период" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[28px] border-stone-200 bg-stone-50 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-stone-200 bg-white px-6 py-5">
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-stone-900">
            <BarChart3 className="h-3.5 w-3.5" />
            Статистика публикации
          </div>
          <DialogTitle className="text-2xl font-semibold text-stone-950">{title}</DialogTitle>
          <DialogDescription>
            Обзор эффективности, действий пользователей и следующих точек роста для {entityLabel}.
          </DialogDescription>
        </DialogHeader>

        {periodized ? (
          <div className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
            <p className="mb-2 text-sm font-semibold text-stone-700">Период статистики</p>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Период статистики">
              {periods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { if (item.id === "custom") setCalendarOpen(true); else { setCalendarOpen(false); setPeriod(item.id); } }}
                  aria-pressed={period === item.id}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                    period === item.id
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {calendarOpen ? (
              <StatisticsRangeCalendar key={`${entityId}-${minDate}`} min={minDate} max={todayDate}
                from={fromDate < minDate ? minDate : fromDate} to={toDate}
                onCancel={() => setCalendarOpen(false)}
                onApply={(from, to) => { setFromDate(from); setToDate(to); setPeriod("custom"); setCalendarOpen(false); }} />
            ) : period === "custom" ? <p className="mt-3 text-sm text-stone-600">{fromDate} — {toDate}</p> : null}
            <p className="mt-2 text-xs text-stone-500">
              Время Минска. Неделя — последние 7 дней, месяц — последние 30 дней.
            </p>
            {error ? <p role="alert" className="mt-2 text-xs text-red-600">{error}</p> : null}
          </div>
        ) : null}

        <div className={cn("space-y-6 p-4 sm:p-6", loading && "opacity-60")} aria-busy={loading}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-500">
              Обзор
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Просмотры"
                value={data ? formatNumber(data.views) : "—"}
                icon={BarChart3}
                hint={periodized ? "Просмотры за выбранный период" : "Открытия публикации"}
              />
              <MetricCard
                label="Сохранения"
                value={data ? formatNumber(data.saves) : "—"}
                icon={Save}
                hint="Интерес без даты"
              />
              <MetricCard
                label="Добавили в план"
                value={data ? formatNumber(data.planAdds) : "—"}
                icon={CalendarDays}
                hint={periodized ? "Добавления за выбранный период" : "Сейчас в планах пользователей"}
              />
              <MetricCard
                label="Действия"
                value={data ? formatNumber(data.ctaClicks) : "—"}
                icon={MousePointerClick}
                hint="CTA interactions"
              />
              <MetricCard
                label="CTR"
                value={data ? percent(ctr) : "—"}
                icon={Target}
                hint="Действия / просмотры"
              />
            </div>
          </section>

          {periodized && promotionPeriods.length > 0 ? (
            <p className="text-xs text-stone-500">
              Отчёты Boost ниже показывают каждый полный период продвижения отдельно от выбранного фильтра.
            </p>
          ) : null}
          <PromotionResultsSection
            periods={promotionPeriods}
            repeatPromotionHref={repeatPromotionHref}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-500" />
                <h3 className="text-sm font-semibold text-stone-500">
                  Аудитория
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {["Возраст детей", "Семейные сегменты", "Интересы"].map((label, index) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-2xl border p-4",
                      index === 0 && "border-lime-200 bg-lime-50",
                      index === 1 && "border-sky-200 bg-sky-50",
                      index === 2 && "border-violet-200 bg-violet-50",
                    )}
                  >
                    <div className="text-sm font-medium text-stone-950">{label}</div>
                    <p className="mt-1 text-xs leading-5 text-stone-600">
                      Данные появятся после накопления достаточной аудитории.
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-lime-200 bg-lime-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-stone-900" />
                <h3 className="text-sm font-semibold text-stone-700">
                  Рекомендации
                </h3>
              </div>
              <ul className="space-y-3 text-sm leading-6 text-stone-700">
                <li>Публикации с галереей получают больше сохранений.</li>
                <li>Добавьте понятный CTA: сайт, запись, телефон или мессенджер.</li>
                <li>Продвижение лучше запускать, когда карточка уже набрала первые действия.</li>
              </ul>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

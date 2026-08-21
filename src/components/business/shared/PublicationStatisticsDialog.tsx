"use client";

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
  metrics,
  promotionPeriods = [],
  repeatPromotionHref,
}: PublicationStatisticsDialogProps) {
  const data = metrics ?? ZERO_METRICS;
  const ctr = data.views > 0 ? (data.ctaClicks / data.views) * 100 : 0;
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

        <div className="space-y-6 p-4 sm:p-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-500">
              Обзор
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Просмотры"
                value={formatNumber(data.views)}
                icon={BarChart3}
                hint="Открытия публикации"
              />
              <MetricCard
                label="Сохранения"
                value={formatNumber(data.saves)}
                icon={Save}
                hint="Интерес без даты"
              />
              <MetricCard
                label="Добавили в план"
                value={formatNumber(data.planAdds)}
                icon={CalendarDays}
                hint="Сейчас в планах пользователей"
              />
              <MetricCard
                label="Действия"
                value={formatNumber(data.ctaClicks)}
                icon={MousePointerClick}
                hint="CTA interactions"
              />
              <MetricCard
                label="CTR"
                value={percent(ctr)}
                icon={Target}
                hint="Действия / просмотры"
              />
            </div>
          </section>

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

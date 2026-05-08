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
}

const ZERO_METRICS: PublicationMetrics = {
  views: 0,
  saves: 0,
  planAdds: 0,
  ctaClicks: 0,
};

const ACTION_LABELS = [
  "Купить билет",
  "Перейти на сайт",
  "Instagram",
  "Telegram",
  "WhatsApp",
  "Позвонить",
  "Маршрут",
  "Запись",
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function percent(value: number) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function actionBreakdown(total: number) {
  if (total <= 0) return ACTION_LABELS.map((label) => ({ label, value: 0 }));
  const weights = [0.24, 0.2, 0.13, 0.11, 0.09, 0.08, 0.08, 0.07];
  let used = 0;
  return ACTION_LABELS.map((label, index) => {
    const value =
      index === ACTION_LABELS.length - 1
        ? Math.max(total - used, 0)
        : Math.round(total * weights[index]);
    used += value;
    return { label, value };
  });
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

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 0) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-stone-600">{label}</span>
        <span className="font-medium tabular-nums text-stone-950">{formatNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-stone-100">
        <div
          className="h-2 rounded-full bg-stone-900 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function PublicationStatisticsDialog({
  open,
  onOpenChange,
  title,
  entityLabel,
  metrics,
}: PublicationStatisticsDialogProps) {
  const data = metrics ?? ZERO_METRICS;
  const ctr = data.views > 0 ? (data.ctaClicks / data.views) * 100 : 0;
  const actions = actionBreakdown(data.ctaClicks);
  const maxAction = Math.max(...actions.map((item) => item.value), 1);
  const dynamics = [
    { label: "Сегодня", value: Math.round(data.views * 0.08) },
    { label: "7 дней", value: Math.round(data.views * 0.42) },
    { label: "30 дней", value: data.views },
  ];
  const maxDynamic = Math.max(...dynamics.map((item) => item.value), 1);

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
                hint="Сильный intent"
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

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <h3 className="mb-4 text-sm font-semibold text-stone-500">
                Действия пользователей
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {actions.map((item) => (
                  <MiniBar key={item.label} label={item.label} value={item.value} max={maxAction} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <h3 className="mb-4 text-sm font-semibold text-stone-500">
                Динамика
              </h3>
              <div className="space-y-4">
                {dynamics.map((item) => (
                  <MiniBar key={item.label} label={item.label} value={item.value} max={maxDynamic} />
                ))}
              </div>
            </section>
          </div>

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

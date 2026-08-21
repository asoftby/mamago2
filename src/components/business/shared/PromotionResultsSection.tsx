import Link from "next/link";
import { BarChart3, CalendarDays, MousePointerClick, Save, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { PromotionPeriod } from "@/server/services/promotion/boostPerformance.service";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDuration(durationMs: number) {
  const hours = Math.max(Math.round(durationMs / (60 * 60 * 1000)), 0);
  if (hours < 24) return `${hours} ч`;

  const days = Math.round(hours / 24);
  const suffix =
    days % 10 === 1 && days % 100 !== 11
      ? "день"
      : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14)
        ? "дня"
        : "дней";
  return `${days} ${suffix}`;
}

function formatElapsed(period: PromotionPeriod) {
  const totalDays = Math.max(Math.ceil(period.durationMs / (24 * 60 * 60 * 1000)), 1);
  const elapsedDays = Math.min(
    Math.max(Math.ceil(period.elapsedMs / (24 * 60 * 60 * 1000)), 1),
    totalDays,
  );
  return `Прошло ${elapsedDays} из ${totalDays} дн.`;
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof BarChart3;
}) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-3">
      <Icon className="h-3.5 w-3.5 text-stone-400" />
      <p className="mt-2 text-lg font-semibold tabular-nums text-stone-950">{formatNumber(value)}</p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}

function ComparedMetric({
  label,
  before,
  during,
  uplift,
  multiplier,
}: {
  label: string;
  before: number;
  during: number;
  uplift: number | null;
  multiplier?: number | null;
}) {
  const comparison = multiplier != null
    ? `×${multiplier.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
    : uplift != null
      ? `+${Math.round(uplift)}%`
      : null;

  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        {comparison ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" />
            {comparison}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-stone-400">До</p>
          <p className="font-semibold tabular-nums text-stone-900">{formatNumber(before)}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400">Во время</p>
          <p className="font-semibold tabular-nums text-stone-900">{formatNumber(during)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {before > 0 ? "Сравнение с предыдущим равным периодом" : "До продвижения — 0"}
      </p>
    </div>
  );
}

function PeriodCard({
  period,
  index,
  repeatPromotionHref,
}: {
  period: PromotionPeriod;
  index: number;
  repeatPromotionHref?: string;
}) {
  const dateRange = `${format(period.startAt, "d MMMM", { locale: ru })} — ${format(period.endAt, "d MMMM", { locale: ru })}`;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-stone-950">
              {index === 0 ? "Последнее продвижение" : `Продвижение ${index + 1}`}
            </h4>
            {period.isActive ? (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-950">
                <Zap className="mr-1 h-3 w-3 fill-amber-400 text-amber-500 motion-safe:animate-[pulse_1.8s_ease-in-out_infinite] motion-reduce:animate-none" />
                Активно
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                Завершено
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-500">{dateRange} · {formatDuration(period.durationMs)}</p>
          {period.isActive ? <p className="mt-1 text-xs text-amber-800">{formatElapsed(period)}</p> : null}
        </div>
        {index === 0 && !period.isActive && repeatPromotionHref ? (
          <Link
            href={repeatPromotionHref}
            className="inline-flex h-9 items-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
          >
            <Zap className="mr-1.5 h-4 w-4 fill-amber-400 text-amber-500" />
            Продвинуть снова
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Metric label="Просмотры за время промо" value={period.metrics.views} icon={BarChart3} />
        <Metric label="Добавили в план" value={period.metrics.planAdds} icon={CalendarDays} />
        <Metric label="Сохранения" value={period.metrics.saves} icon={Save} />
        <Metric label="Действия" value={period.metrics.ctaClicks} icon={MousePointerClick} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ComparedMetric
          label="Просмотры"
          before={period.baselineMetrics.views}
          during={period.metrics.views}
          uplift={null}
          multiplier={period.comparison.viewsMultiplier}
        />
        <ComparedMetric
          label="Добавили в план"
          before={period.baselineMetrics.planAdds}
          during={period.metrics.planAdds}
          uplift={period.comparison.planAddsPercentChange}
        />
      </div>
    </article>
  );
}

export function PromotionResultsSection({
  periods,
  repeatPromotionHref,
}: {
  periods: PromotionPeriod[];
  repeatPromotionHref?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-stone-700">Результаты продвижения</h3>
        <p className="mt-1 text-xs text-stone-500">
          Реальные действия пользователей за каждый период Boost. Сравнение использует равный период непосредственно до продвижения.
        </p>
      </div>

      {periods.length > 0 ? (
        <div className="space-y-3">
          {periods.map((period, index) => (
            <PeriodCard
              key={period.id}
              period={period}
              index={index}
              repeatPromotionHref={repeatPromotionHref}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-6 text-sm text-stone-600">
          Продвижений ещё не было. После первого Boost здесь появится отчёт по действиям пользователей за период продвижения.
        </div>
      )}
    </section>
  );
}

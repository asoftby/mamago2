"use client";

import { useState, useTransition, type ComponentType, type ReactNode } from "react";
import { startOfDay, subDays, format } from "date-fns";
import {
  Calendar,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import type { RevenueSnapshot } from "@/lib/admin/dashboardData";
import { fetchRevenueSnapshot } from "@/app/admin/actions";
import { DateRangePicker } from "./DateRangePicker";

type Period = "today" | "7d" | "30d" | "custom";

function getPeriodDates(period: Period, custom?: { from: Date; to: Date }) {
  const now = new Date();
  const today = startOfDay(now);
  if (period === "today") return { from: today, to: now };
  if (period === "7d") return { from: subDays(today, 7), to: now };
  if (period === "30d") return { from: subDays(today, 30), to: now };
  if (period === "custom" && custom) return custom;
  return { from: today, to: now };
}

function formatCurrency(amount: number): ReactNode {
  return renderCurrencyText(formatPrice(amount, { hideZero: true }), {
    iconSize: "text",
  });
}

function FinanceStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  sublabel,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-2 flex min-w-0 items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClassName)} />
        <p className="min-w-0 break-words text-sm leading-snug text-gray-600">
          {label}
        </p>
      </div>
      <p className="min-w-0 break-words text-base font-bold tabular-nums leading-tight text-gray-900">
        {value}
      </p>
      {sublabel != null ? (
        <p className="mt-1 min-w-0 break-words text-xs text-gray-500">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-3 sm:p-4 h-[88px]" >
      <div className="mb-2 flex items-start gap-2">
        <div className="mt-0.5 h-4 w-4 rounded bg-gray-200 shrink-0" />
        <div className="h-4 w-24 rounded bg-gray-200" />
      </div>
      <div className="h-5 w-16 rounded bg-gray-200" />
    </div>
  );
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  custom: "Интервал",
};

const PREV_LABELS: Record<Period, string> = {
  today: "Вчера:",
  "7d": "Пред. 7 дней:",
  "30d": "Пред. 30 дней:",
  custom: "Предыдущий период:",
};

export function FinanceSectionClient({
  initialData,
}: {
  initialData: RevenueSnapshot;
}) {
  const [period, setPeriod] = useState<Period>("today");
  const [customRange, setCustomRange] = useState<
    { from: Date; to: Date } | undefined
  >();
  const [data, setData] = useState(initialData);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();

  function changePeriod(p: Period, custom?: { from: Date; to: Date }) {
    setPeriod(p);
    const { from, to } = getPeriodDates(p, custom);
    startTransition(async () => {
      const next = await fetchRevenueSnapshot(
        from.toISOString(),
        to.toISOString(),
      );
      setData(next);
    });
  }

  const customLabel =
    customRange && period === "custom"
      ? `${format(customRange.from, "dd.MM.yyyy")} — ${format(customRange.to, "dd.MM.yyyy")}`
      : "Интервал";

  const prevLabel = `${PREV_LABELS[period]} ${formatCurrency(data.revenuePrev)}`;

  const periodSublabel =
    period === "today"
      ? "За сегодня"
      : period === "7d"
        ? "За 7 дней"
        : period === "30d"
          ? "За 30 дней"
          : customRange
            ? `${format(customRange.from, "dd.MM")} — ${format(customRange.to, "dd.MM")}`
            : undefined;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg md:text-base font-semibold text-gray-900">
          Финансы
        </h2>
        <div className="flex items-center gap-1">
          {(["today", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePeriod(p)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md border transition-colors",
                period === p
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
                period === "custom"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
              )}
            >
              <Calendar className="w-3 h-3" />
              {customLabel}
            </button>
            {showPicker && (
              <DateRangePicker
                onApply={(from, to) => {
                  setCustomRange({ from, to });
                  setShowPicker(false);
                  changePeriod("custom", { from, to });
                }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {isPending ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <FinanceStatCard
              icon={DollarSign}
              iconClassName="text-green-600"
              label="Выручка"
              value={formatCurrency(data.revenue)}
              sublabel={prevLabel}
            />
            <FinanceStatCard
              icon={TrendingUp}
              iconClassName="text-blue-600"
              label="MRR"
              value={formatCurrency(data.mrr)}
            />
            <FinanceStatCard
              icon={TrendingUp}
              iconClassName="text-purple-600"
              label="Буст"
              value={formatCurrency(data.boostRevenue)}
              sublabel={periodSublabel}
            />
            <FinanceStatCard
              icon={CheckCircle}
              iconClassName="text-green-600"
              label="Новые подписки"
              value={data.newSubscriptions}
              sublabel={periodSublabel}
            />
            <FinanceStatCard
              icon={Users}
              iconClassName="text-blue-600"
              label="Лиды"
              value={data.leadsGenerated}
              sublabel={periodSublabel}
            />
          </>
        )}
      </div>
    </section>
  );
}

"use client";

import { TrendingDown, Receipt, DollarSign, Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatPrice } from "@/lib/formatters/format-price";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle: string;
}

function StatCard({ icon: Icon, label, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
          <Icon className="w-5 h-5 text-stone-600" />
        </div>
        <p className="text-sm font-medium text-stone-600">{label}</p>
      </div>
      <p className="text-2xl font-bold text-stone-950 mb-1">{value}</p>
      <p className="text-xs text-stone-500">{subtitle}</p>
    </div>
  );
}

interface BalanceStatsProps {
  monthSpent: number;
  chargesCount: number;
  averageCharge: number;
  leadsCount: number;
  lastChargeDate: Date | null;
  lastChargeAmount: number | null;
}

export function BalanceStats({
  monthSpent,
  chargesCount,
  averageCharge,
  leadsCount,
  lastChargeDate,
  lastChargeAmount,
}: BalanceStatsProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-stone-950 mb-4">Статистика за месяц</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingDown}
          label="Потрачено"
          value={formatPrice(monthSpent)}
          subtitle="В текущем месяце"
        />
        <StatCard
          icon={Receipt}
          label="Заявок"
          value={leadsCount.toString()}
          subtitle="За текущий месяц"
        />
        <StatCard
          icon={DollarSign}
          label="Средняя стоимость заявки"
          value={formatPrice(averageCharge)}
          subtitle={`${chargesCount} списаний за месяц`}
        />
        <StatCard
          icon={Calendar}
          label="Последнее списание"
          value={lastChargeAmount !== null ? formatPrice(lastChargeAmount) : "—"}
          subtitle={
            lastChargeDate
              ? format(lastChargeDate, "d MMMM", { locale: ru })
              : "Нет операций"
          }
        />
      </div>
    </div>
  );
}

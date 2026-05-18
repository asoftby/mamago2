"use client";

import { Eye, Users, Heart, CalendarPlus, MousePointerClick, ShoppingCart, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PublicationStatsSummaryData {
  viewsTotal: number | null;
  viewsUnique: number | null;
  saves: number | null;
  planAdds: number | null;
  buyClicks: number | null;
  conversionToPlan: number | null;
  updatedAt: string | null;
}

interface StatCellProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

function StatCell({ icon, label, value, muted }: StatCellProps) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={cn("shrink-0", muted ? "text-gray-300" : "text-gray-400")}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-gray-400 leading-none truncate">{label}</p>
        <p className={cn("text-[13px] font-semibold tabular-nums leading-tight", muted ? "text-gray-400" : "text-gray-700")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("ru-RU");
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "—";
  }
}

/**
 * Компактный summary-блок статистики публикации.
 * Показывается прямо в строке/карточке списка публикаций.
 * Не делает никаких запросов — данные передаются снаружи.
 */
export function PublicationStatsSummary({
  data,
  className,
}: {
  data: PublicationStatsSummaryData;
  className?: string;
}) {
  const allNull =
    data.viewsTotal === null &&
    data.viewsUnique === null &&
    data.saves === null &&
    data.planAdds === null &&
    data.buyClicks === null &&
    data.conversionToPlan === null;

  if (allNull) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[11px] text-gray-400", className)}>
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Нет данных</span>
        {data.updatedAt && (
          <span className="text-gray-300">· {fmtDate(data.updatedAt)}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <StatCell icon={<Eye className="h-3 w-3" />} label="просмотры" value={fmt(data.viewsTotal)} />
      <StatCell icon={<Users className="h-3 w-3" />} label="уникальные" value={fmt(data.viewsUnique)} />
      {data.saves !== null && (
        <StatCell icon={<Heart className="h-3 w-3" />} label="сохранения" value={fmt(data.saves)} />
      )}
      {data.planAdds !== null && (
        <StatCell icon={<CalendarPlus className="h-3 w-3" />} label="в план" value={fmt(data.planAdds)} />
      )}
      {data.buyClicks !== null && (
        <StatCell icon={<MousePointerClick className="h-3 w-3" />} label="CTA" value={fmt(data.buyClicks)} />
      )}
      {data.conversionToPlan !== null && (
        <StatCell icon={<TrendingUp className="h-3 w-3" />} label="конверсия" value={fmtPct(data.conversionToPlan)} />
      )}
      {data.updatedAt && (
        <StatCell icon={<Clock className="h-3 w-3" />} label="обновлено" value={fmtDate(data.updatedAt)} muted />
      )}
    </div>
  );
}

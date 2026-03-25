import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SeoSummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}

/**
 * KPI / метрика для дашборда и сводок.
 */
export function SeoSummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  emphasize,
}: SeoSummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        emphasize ? "border-amber-200 bg-amber-50/40" : "border-gray-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            emphasize ? "bg-amber-100 text-amber-800" : "bg-gray-50 text-gray-600",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          emphasize ? "text-amber-900" : "text-gray-900",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-snug text-gray-500">{hint}</p>
    </div>
  );
}

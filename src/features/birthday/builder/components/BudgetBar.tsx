"use client";

import { useState } from "react";
import type { BirthdayOffer, BirthdayBudgetGroup } from "../../types/birthday";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";
import { getBudgetRange, formatBudgetRange } from "../lib/budgetRanges";
import { cn } from "@/lib/utils";

type BudgetStatus = "can_add" | "in_budget" | "almost" | "exceeded";

const LAYER_LABELS: Record<string, string> = {
  BASE: "Площадка",
  ENTERTAINMENT: "Развлечения",
  FOOD: "Еда и торты",
  DECOR: "Декор",
  EXTRA: "Допуслуги",
};

function getBudgetStatus(
  total: number,
  budgetMin: number,
  budgetMax: number
): BudgetStatus {
  if (total > budgetMax) return "exceeded";
  if (total >= budgetMax * 0.8) return "almost";
  if (total >= budgetMin) return "in_budget";
  return "can_add";
}

function getStatusLabel(status: BudgetStatus, total: number, budgetMax: number): string {
  switch (status) {
    case "can_add":
      return "Можно добавить ещё";
    case "in_budget":
      return "В пределах бюджета";
    case "almost":
      return "Почти достигли бюджета";
    case "exceeded":
      return `Превышен на +${formatPrice(total - budgetMax, { hideZero: true })}`;
    default:
      return "";
  }
}

interface BudgetBarProps {
  totalPrice: number;
  budgetGroup: BirthdayBudgetGroup | null;
  offers: BirthdayOffer[];
  /** Compact: single line in sticky bar. Expanded: full block with progress */
  variant?: "compact" | "expanded";
  className?: string;
}

export function BudgetBar({
  totalPrice,
  budgetGroup,
  offers,
  variant = "compact",
  className,
}: BudgetBarProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const range = getBudgetRange(budgetGroup);
  const budgetMin = range?.min ?? 0;
  const budgetMax = range?.max ?? 1000;
  const status = range ? getBudgetStatus(totalPrice, budgetMin, budgetMax) : "in_budget";
  const displayMax = budgetMax >= 5000 ? Math.max(budgetMin * 1.5, totalPrice * 1.2, 2000) : budgetMax;
  const progressPercent = Math.min((totalPrice / displayMax) * 100, 100);
  const statusLabel = getStatusLabel(status, totalPrice, budgetMax);
  const rangeLabel = formatBudgetRange(budgetGroup);

  const statusStyles = {
    can_add: "text-emerald-600",
    in_budget: "text-emerald-600",
    almost: "text-amber-600",
    exceeded: "text-red-600",
  };

  const barStyles = {
    can_add: "bg-emerald-500",
    in_budget: "bg-emerald-500",
    almost: "bg-amber-500",
    exceeded: "bg-red-500",
  };

  const breakdown = offers
    .filter((o) => o.priceFrom != null)
    .map((o) => ({
      label: LAYER_LABELS[o.layer] || o.layer,
      title: o.title,
      price: o.priceFrom!,
    }));

  if (!budgetGroup || budgetGroup === "unknown") {
    return (
      <div className={cn("text-xs", className)}>
        <span className="font-semibold text-foreground">{formatPrice(totalPrice, { hideZero: true })}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-col gap-0.5 min-w-0 shrink-0",
          breakdown.length > 0 && "cursor-pointer",
          className
        )}
        onClick={() => breakdown.length > 0 && setShowBreakdown(!showBreakdown)}
        onKeyDown={(e) =>
          breakdown.length > 0 && (e.key === "Enter" || e.key === " ") && setShowBreakdown(!showBreakdown)
        }
        role={breakdown.length > 0 ? "button" : undefined}
        tabIndex={breakdown.length > 0 ? 0 : undefined}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-foreground text-xs whitespace-nowrap">
            {formatPrice(totalPrice, { hideZero: true })} из {rangeLabel}
          </span>
          <span className={cn("text-[11px] font-medium", statusStyles[status])}>
            {statusLabel}
          </span>
        </div>
        <div className="h-0.5 w-full min-w-[60px] max-w-[100px] rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-300", barStyles[status])}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {showBreakdown && breakdown.length > 0 && (
          <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {breakdown.map((b) => (
              <div key={b.title} className="flex justify-between gap-2">
                <span className="truncate">{b.label}: {b.title}</span>
                <span className="shrink-0">{formatPrice(b.price, { hideZero: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        status === "exceeded" && "border-red-200 bg-red-50/50",
        status === "almost" && "border-amber-200 bg-amber-50/30",
        (status === "in_budget" || status === "can_add") && "border-emerald-200/60 bg-emerald-50/30",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {formatPrice(totalPrice, { hideZero: true })} из {rangeLabel}
        </span>
        <span className={cn("text-sm font-medium", statusStyles[status])}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barStyles[status])}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      {breakdown.length > 0 && (
        <details className="mt-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none inline-flex items-center gap-1">
            Состав ▼
          </summary>
          <div className="mt-2 space-y-1.5 text-xs">
            {breakdown.map((b) => (
              <div key={b.title} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate">{b.label}: {b.title}</span>
                <span className="shrink-0 font-medium text-foreground">{formatPrice(b.price, { hideZero: true })}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

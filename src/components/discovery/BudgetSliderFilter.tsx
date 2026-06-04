"use client";

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { cn } from "@/lib/utils";
import { getBudgetStep } from "@/lib/discovery/budgetUtils";
import { useBudgetFilter } from "@/features/filters/discovery/useBudgetFilter";

interface BudgetSliderFilterProps {
  max: number;
  className?: string;
}

export function BudgetSliderFilter({ max, className }: BudgetSliderFilterProps) {
  const { budget, setBudget, clearBudget } = useBudgetFilter();
  const step = getBudgetStep(max);

  // Нет активного значения → слайдер в максимуме (фильтр не применён)
  const sliderValue = budget ?? max;
  const isActive = budget !== null && budget < max;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    // Если бегунок на максимуме — сбрасываем фильтр
    setBudget(v >= max ? null : v);
  };

  return (
    <div
      className={cn(
        "px-4 py-3 bg-white border border-gray-200 rounded-2xl space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Бюджет</span>
        {isActive && (
          <button
            type="button"
            onClick={clearBudget}
            className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={sliderValue}
        onChange={handleChange}
        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-gray-900"
        aria-label="Максимальный бюджет"
      />

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Бесплатно</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            isActive ? "text-gray-900" : "text-gray-400",
          )}
        >
          {isActive ? `до ${budget} ${BYN_SYMBOL}` : `до ${max} ${BYN_SYMBOL}`}
        </span>
      </div>
    </div>
  );
}

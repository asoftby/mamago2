"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SecondaryFiltersForm } from "@/components/discovery/SecondaryFiltersForm";
import type { Intent } from "@/lib/intent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";
import { useBudgetFilter } from "@/features/filters/discovery/useBudgetFilter";
import { useOptionalDiscoveryBudgetConfig } from "@/features/filters/discovery/discoveryBudgetContext";
import { getModalFilterCount, useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { EventAdvancedFilters } from "@/components/discovery/EventAdvancedFilters";

interface RefinementFiltersButtonCompactProps {
  className?: string;
  intent?: Intent | string | null;
}

export function RefinementFiltersButtonCompact({
  className,
  intent,
}: RefinementFiltersButtonCompactProps) {
  const [open, setOpen] = useState(false);
  const safeIntent = (intent ?? null) as Intent | null;
  const { activeCount: secondaryActiveCount } =
    useSecondaryFiltersFromUrl(safeIntent);
  const budgetCtx = useOptionalDiscoveryBudgetConfig();
  const budgetConfig = budgetCtx?.budgetConfig ?? null;
  const { budget } = useBudgetFilter();
  const { applied } = useDiscoveryFilters();
  const citySlug = useOptionalCity()?.citySlug ?? DEFAULT_CITY_SLUG;
  const budgetActive =
    Boolean(budgetConfig) &&
    budget !== null &&
    budget < (budgetConfig?.max ?? Number.POSITIVE_INFINITY);
  const activeCount = safeIntent === "kuda"
    ? getModalFilterCount(applied)
    : secondaryActiveCount + (budgetActive ? 1 : 0);

  if (!safeIntent) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-secondary-filters-trigger
          aria-label="Фильтры — нажмите, чтобы открыть"
          aria-expanded={open}
          aria-haspopup="dialog"
          suppressHydrationWarning
          className={cn(
            "flex h-full min-h-[52px] shrink-0 items-center justify-center gap-2 self-stretch rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm transition-colors duration-200",
            "hover:border-gray-300 hover:bg-gray-50 hover:shadow-md",
            "active:scale-[0.98]",
            className,
          )}
        >
          <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Фильтры</span>
          {/*
            Всегда одинаковая вложенность: иначе при расхождении activeCount (SSR vs URL на клиенте)
            меняется дерево и съезжают useId у Radix Dialog → aria-controls mismatch.
          */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              activeCount === 0 && "invisible w-0 min-w-0 overflow-hidden p-0",
            )}
            aria-hidden={activeCount === 0}
          >
            <span className="text-gray-400 mx-1">·</span>
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-bold text-white">
              {activeCount > 0 ? activeCount : "\u00a0"}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,800px)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">Фильтры</DialogTitle>
          <DialogDescription className="sr-only">
            Дополнительные фильтры для уточнения подборки событий.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-6 py-4">
          {safeIntent === "kuda" ? (
            <EventAdvancedFilters citySlug={citySlug} onApply={() => setOpen(false)} />
          ) : (
            <SecondaryFiltersForm intent={safeIntent} compact onApply={() => setOpen(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

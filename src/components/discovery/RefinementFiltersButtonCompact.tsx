"use client";

import { useState } from "react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogClose,
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
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useEventListingCitySlug } from "@/lib/city/useEventListingCitySlug";
import { EventAdvancedFilters, getEventRefinementCount } from "@/components/discovery/EventAdvancedFilters";

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
  const citySlug = useEventListingCitySlug();
  const budgetActive =
    Boolean(budgetConfig) &&
    budget !== null &&
    budget < (budgetConfig?.max ?? Number.POSITIVE_INFINITY);
  const activeCount = safeIntent === "kuda"
    ? getEventRefinementCount(applied)
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
            <span className="h-[5px] w-[5px] rounded-full bg-red-500" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,800px)] max-w-[calc(100%-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex !flex-row shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-4 py-3 text-left sm:px-5">
          <div>
            <DialogTitle className="text-lg font-semibold text-neutral-900">Фильтры</DialogTitle>
            <DialogDescription className="sr-only">
              Дополнительные фильтры для уточнения подборки событий.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <ModalCloseButton aria-label="Закрыть фильтры" />
          </DialogClose>
        </DialogHeader>
        <div className={cn("min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 sm:px-5", safeIntent === "kuda" ? "pb-0" : "pb-4")}>
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

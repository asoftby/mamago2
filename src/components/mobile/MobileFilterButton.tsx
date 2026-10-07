"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import type { Intent } from "@/lib/intent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

interface MobileFilterButtonProps {
  intent?: Intent | string;
  className?: string;
}

export function MobileFilterButton({ intent, className }: MobileFilterButtonProps) {
  const { setIsOpen, setCurrentIntent } = useRefinementFilters();
  const safeIntent = intent as Intent | null;
  const { activeCount: secondaryActiveCount } = useSecondaryFiltersFromUrl(safeIntent);
  const { derived } = useDiscoveryFilters();
  const activeCount = safeIntent === "kuda" ? derived.activeCount : secondaryActiveCount;

  const handleClick = () => {
    if (intent) {
      setCurrentIntent(intent);
    }
    setIsOpen(true);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm transition-all duration-200 active:scale-[0.98]",
        activeCount > 0
          ? "border-brand bg-brand"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
        className,
      )}
      aria-label={activeCount > 0 ? `Фильтры, активно: ${activeCount}` : "Открыть фильтры"}
    >
      <SlidersHorizontal className={cn("h-5 w-5", activeCount > 0 ? "text-[#1A1A1A]" : "text-gray-600")} />

      {activeCount > 0 && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-xs font-bold text-white">
          {activeCount}
        </div>
      )}
    </button>
  );
}

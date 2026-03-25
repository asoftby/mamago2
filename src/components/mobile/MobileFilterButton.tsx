"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import type { Intent } from "@/lib/intent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";

interface MobileFilterButtonProps {
  intent?: Intent | string;
  className?: string;
}

export function MobileFilterButton({ intent, className }: MobileFilterButtonProps) {
  const { setIsOpen, setCurrentIntent } = useRefinementFilters();
  const safeIntent = intent as Intent | null;
  const { activeCount } = useSecondaryFiltersFromUrl(safeIntent);

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
        "relative flex h-[52px] w-[52px] items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md active:scale-[0.98]",
        className,
      )}
      aria-label="Открыть фильтры"
    >
      <SlidersHorizontal className="h-5 w-5 text-gray-600" />

      {activeCount > 0 && (
        <div className="absolute -top-1 -right-1 bg-[#EF8759] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {activeCount}
        </div>
      )}
    </button>
  );
}

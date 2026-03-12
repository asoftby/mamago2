"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import { FilterState } from "./RefinementFiltersModal";

interface RefinementFiltersButtonProps {
  className?: string;
  intent?: string; // Add intent prop
}

// Helper function to count active filters
const countActiveFilters = (filters: FilterState): number => {
  let count = 0;
  count += filters.types.length;
  count += filters.isFree ? 1 : 0;
  count += filters.categories.length;
  return count;
};

export function RefinementFiltersButton({ 
  className,
  intent,
}: RefinementFiltersButtonProps) {
  const { getFilters, setIsOpen, setCurrentIntent } = useRefinementFilters();
  
  // Get filters for this intent
  const filters = intent ? getFilters(intent) : {
    types: [],
    isFree: false,
    categories: [],
  };
  
  const activeCount = countActiveFilters(filters);

  const handleClick = () => {
    if (intent) {
      setCurrentIntent(intent);
    }
    setIsOpen(true);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2.5 px-5 py-3 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-all duration-200 text-sm font-semibold text-gray-800 hover:text-gray-900 shadow-sm hover:shadow-md hover:border-gray-400 hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span>Фильтры</span>
      {activeCount > 0 && (
        <>
          <span className="text-gray-400 mx-1">·</span>
          <span className="bg-gray-900 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {activeCount}
          </span>
        </>
      )}
    </button>
  );
}
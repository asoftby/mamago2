"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";
import { FilterState } from "@/components/discovery/RefinementFiltersModal";

interface MobileFilterButtonProps {
  intent?: string;
  className?: string;
}

// Helper function to count active filters
const countActiveFilters = (filters: FilterState): number => {
  let count = 0;
  count += filters.types.length;
  count += filters.isFree ? 1 : 0;
  count += filters.categories.length;
  return count;
};

export function MobileFilterButton({ intent, className }: MobileFilterButtonProps) {
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
        "relative flex items-center justify-center w-[52px] h-[52px] rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]",
        className
      )}
    >
      <SlidersHorizontal className="h-5 w-5 text-gray-600" />
      
      {/* Active filter count badge */}
      {activeCount > 0 && (
        <div className="absolute -top-1 -right-1 bg-[#EF8759] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {activeCount}
        </div>
      )}
    </button>
  );
}
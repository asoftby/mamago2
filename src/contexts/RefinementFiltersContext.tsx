"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { FilterState } from "@/components/discovery/RefinementFiltersModal";

interface RefinementFiltersContextType {
  getFilters: (intent: string) => FilterState;
  setFilters: (intent: string, filters: FilterState) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentIntent: string | null;
  setCurrentIntent: (intent: string | null) => void;
}

const RefinementFiltersContext = createContext<RefinementFiltersContextType | undefined>(undefined);

export function RefinementFiltersProvider({ children }: { children: ReactNode }) {
  // Store filters by intent
  const [filtersByIntent, setFiltersByIntent] = useState<Record<string, FilterState>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<string | null>(null);

  const getFilters = (intent: string): FilterState => {
    return filtersByIntent[intent] || {
      types: [],
      isFree: false,
      categories: [],
    };
  };

  // Safe setter with error handling
  const setFilters = (intent: string, newFilters: FilterState) => {
    try {
      setFiltersByIntent(prev => ({
        ...prev,
        [intent]: newFilters
      }));
    } catch (error) {
      console.warn('Error updating filters:', error);
    }
  };

  return (
    <RefinementFiltersContext.Provider value={{
      getFilters,
      setFilters,
      isOpen,
      setIsOpen,
      currentIntent,
      setCurrentIntent,
    }}>
      {children}
    </RefinementFiltersContext.Provider>
  );
}

export function useRefinementFilters() {
  const context = useContext(RefinementFiltersContext);
  if (context === undefined) {
    throw new Error('useRefinementFilters must be used within a RefinementFiltersProvider');
  }
  return context;
}
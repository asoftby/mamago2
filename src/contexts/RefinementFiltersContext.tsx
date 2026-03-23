"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/**
 * Только UI-состояние secondary-фильтров на mobile (bottom sheet).
 * Сами значения фильтров — в URL (`sec`), см. useSecondaryFiltersFromUrl.
 */
interface RefinementFiltersContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentIntent: string | null;
  setCurrentIntent: (intent: string | null) => void;
}

const RefinementFiltersContext = createContext<
  RefinementFiltersContextType | undefined
>(undefined);

export function RefinementFiltersProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<string | null>(null);

  return (
    <RefinementFiltersContext.Provider
      value={{
        isOpen,
        setIsOpen,
        currentIntent,
        setCurrentIntent,
      }}
    >
      {children}
    </RefinementFiltersContext.Provider>
  );
}

export function useRefinementFilters() {
  const context = useContext(RefinementFiltersContext);
  if (context === undefined) {
    throw new Error(
      "useRefinementFilters must be used within a RefinementFiltersProvider",
    );
  }
  return context;
}

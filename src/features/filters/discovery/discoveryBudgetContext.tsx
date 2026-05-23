"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DiscoveryBudgetConfig = { max: number; step: number } | null;

type DiscoveryBudgetContextValue = {
  budgetConfig: DiscoveryBudgetConfig;
  setBudgetConfig: (config: DiscoveryBudgetConfig) => void;
};

const DiscoveryBudgetContext = createContext<
  DiscoveryBudgetContextValue | undefined
>(undefined);

export function DiscoveryBudgetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [budgetConfig, setBudgetConfig] = useState<DiscoveryBudgetConfig>(null);

  const value = useMemo(
    () => ({
      budgetConfig,
      setBudgetConfig,
    }),
    [budgetConfig],
  );

  return (
    <DiscoveryBudgetContext.Provider value={value}>
      {children}
    </DiscoveryBudgetContext.Provider>
  );
}

export function useOptionalDiscoveryBudgetConfig() {
  return useContext(DiscoveryBudgetContext);
}

export function useDiscoveryBudgetConfig() {
  const ctx = useContext(DiscoveryBudgetContext);
  if (!ctx) {
    throw new Error(
      "useDiscoveryBudgetConfig must be used within DiscoveryBudgetProvider",
    );
  }
  return ctx;
}

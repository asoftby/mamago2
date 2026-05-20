"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const BUDGET_URL_KEY = "budget";

export type BudgetFilterState = {
  /** Текущий бюджет из URL; null = фильтр не активен. */
  budget: number | null;
  setBudget: (value: number | null) => void;
  clearBudget: () => void;
};

export function useBudgetFilter(): BudgetFilterState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const budget = useMemo(() => {
    const raw = searchParams.get(BUDGET_URL_KEY);
    const n = raw ? parseInt(raw, 10) : null;
    return n && n > 0 ? n : null;
  }, [searchParams]);

  const setBudget = useCallback(
    (value: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value > 0) {
        params.set(BUDGET_URL_KEY, String(value));
      } else {
        params.delete(BUDGET_URL_KEY);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const clearBudget = useCallback(() => setBudget(null), [setBudget]);

  return { budget, setBudget, clearBudget };
}

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Historical component/API names still say "budget", but discovery has one
 * canonical numeric price constraint: `priceMax`.
 */
export const BUDGET_URL_KEY = "priceMax";
const LEGACY_BUDGET_URL_KEY = "budget";

export type BudgetFilterState = {
  /** Текущий бюджет из URL; null = фильтр не активен. */
  budget: number | null;
  setBudget: (value: number | null) => void;
  clearBudget: () => void;
};

function parsePositiveBudget(raw: string | null): number | null {
  const n = raw ? parseInt(raw, 10) : null;
  return n && n > 0 ? n : null;
}

export function useBudgetFilter(): BudgetFilterState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canonicalBudget = useMemo(
    () => parsePositiveBudget(searchParams.get(BUDGET_URL_KEY)),
    [searchParams],
  );
  const legacyBudget = useMemo(
    () => parsePositiveBudget(searchParams.get(LEGACY_BUDGET_URL_KEY)),
    [searchParams],
  );
  const budget = canonicalBudget ?? legacyBudget;

  // Old shared URLs used `?budget=`. Canonicalize them once so the main
  // DiscoveryFilters store and server-side feeds see the same `priceMax` key.
  useEffect(() => {
    if (canonicalBudget != null || legacyBudget == null) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(BUDGET_URL_KEY, String(legacyBudget));
    params.delete(LEGACY_BUDGET_URL_KEY);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [canonicalBudget, legacyBudget, pathname, router, searchParams]);

  const setBudget = useCallback(
    (value: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(LEGACY_BUDGET_URL_KEY);
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

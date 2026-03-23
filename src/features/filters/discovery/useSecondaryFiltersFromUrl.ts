"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Intent } from "@/lib/intent";
import { getIntentFromPath } from "@/lib/intent";
import {
  SECONDARY_FILTERS_URL_KEY,
  parseSecondaryFromSearchParams,
  getSecondaryForIntent,
  setSecondaryForIntent,
  secondaryLabelsForChips,
  countSecondaryActive,
  type SecondaryValues,
  type SecondaryByIntentState,
} from "@/lib/discovery/secondaryFiltersUrl";

function writeSecondaryToUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams,
  nextAll: SecondaryByIntentState,
) {
  const params = new URLSearchParams(searchParams.toString());
  if (Object.keys(nextAll).length === 0) {
    params.delete(SECONDARY_FILTERS_URL_KEY);
  } else {
    params.set(SECONDARY_FILTERS_URL_KEY, JSON.stringify(nextAll));
  }
  const qs = params.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

export function useSecondaryFiltersFromUrl(intent: Intent | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const all = useMemo(
    () => parseSecondaryFromSearchParams(searchParams),
    [searchParams],
  );

  const values = useMemo(
    () => (intent ? getSecondaryForIntent(all, intent) : {}),
    [all, intent],
  );

  const setValues = useCallback(
    (next: SecondaryValues) => {
      if (!intent) return;
      const merged = setSecondaryForIntent(all, intent, next);
      writeSecondaryToUrl(router, pathname, searchParams, merged);
    },
    [all, intent, pathname, router, searchParams],
  );

  const patch = useCallback(
    (partial: Partial<Record<string, string | string[] | boolean | undefined>>) => {
      if (!intent) return;
      const next: SecondaryValues = { ...values };
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined) {
          delete next[k];
        } else {
          next[k] = v;
        }
      }
      setValues(next);
    },
    [intent, setValues, values],
  );

  const reset = useCallback(() => {
    if (!intent) return;
    const merged = setSecondaryForIntent(all, intent, {});
    writeSecondaryToUrl(router, pathname, searchParams, merged);
  }, [all, intent, pathname, router, searchParams]);

  const chipLabels = useMemo(
    () => (intent ? secondaryLabelsForChips(intent, values) : []),
    [intent, values],
  );

  const activeCount = useMemo(
    () => (intent ? countSecondaryActive(intent, values) : 0),
    [intent, values],
  );

  return {
    values,
    setValues,
    patch,
    reset,
    chipLabels,
    activeCount,
  };
}

/** Intent из pathname для страниц discovery */
export function useDiscoveryIntentFromPath(): Intent | null {
  const pathname = usePathname();
  return getIntentFromPath(pathname);
}

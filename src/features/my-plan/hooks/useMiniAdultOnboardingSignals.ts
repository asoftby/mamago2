"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";
import {
  FALLBACK_PLAN_FORMAT_SIGNALS,
  FALLBACK_PLAN_PREFERENCE_SIGNALS,
  MINI_ONBOARDING_SIGNALS_LIMIT,
  mergeSignalCatalog,
} from "@/features/my-plan/lib/miniAdultOnboardingConfig";

type PlanOnboardingResponse = {
  preferences?: PlanOnboardingSignalChip[];
  formats?: PlanOnboardingSignalChip[];
  resolved?: PlanOnboardingSignalChip[];
};

export function useMiniAdultOnboardingSignals(resolveIds: string[] = []) {
  const [preferenceSignals, setPreferenceSignals] = useState<PlanOnboardingSignalChip[]>([]);
  const [formatSignals, setFormatSignals] = useState<PlanOnboardingSignalChip[]>([]);
  const [resolvedSignals, setResolvedSignals] = useState<PlanOnboardingSignalChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const resolveKey = useMemo(
    () => [...new Set(resolveIds.filter(Boolean))].sort().join(","),
    [resolveIds],
  );

  const loadSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(MINI_ONBOARDING_SIGNALS_LIMIT),
      });
      if (resolveKey) {
        params.set("resolveIds", resolveKey);
      }

      const response = await fetch(`/api/public/signals/plan-onboarding?${params.toString()}`);
      const data = (await response.json()) as PlanOnboardingResponse;

      const preferences = data.preferences ?? [];
      const formats = data.formats ?? [];
      const resolved = data.resolved ?? [];

      const nextPreferences =
        preferences.length > 0 ? preferences : FALLBACK_PLAN_PREFERENCE_SIGNALS;
      const nextFormats = formats.length > 0 ? formats : FALLBACK_PLAN_FORMAT_SIGNALS;

      setPreferenceSignals(nextPreferences);
      setFormatSignals(nextFormats);
      setResolvedSignals(resolved);
      setUsingFallback(preferences.length === 0 || formats.length === 0);
    } catch {
      setPreferenceSignals(FALLBACK_PLAN_PREFERENCE_SIGNALS);
      setFormatSignals(FALLBACK_PLAN_FORMAT_SIGNALS);
      setResolvedSignals([]);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [resolveKey]);

  useEffect(() => {
    void loadSignals();
  }, [loadSignals]);

  const allKnownSignals = useMemo(
    () => mergeSignalCatalog(
      [...preferenceSignals, ...formatSignals],
      resolvedSignals,
    ),
    [formatSignals, preferenceSignals, resolvedSignals],
  );

  return {
    preferenceSignals,
    formatSignals,
    resolvedSignals,
    allKnownSignals,
    loading,
    usingFallback,
    reload: loadSignals,
  };
}

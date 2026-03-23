"use client";

import { useEffect, useState, useMemo } from "react";
import type { PublicAgeSignalOption } from "../lib/ageSignalMapper";
import {
  FALLBACK_AGE_SIGNAL_OPTIONS,
  filterAgeOptionsForBirthdayBuilder,
} from "../lib/ageSignalMapper";

type AgeSignalsResponse = {
  options: PublicAgeSignalOption[];
  error?: string;
};

export type BirthdayAgeSignalsState = ReturnType<typeof useBirthdayAgeSignals>;

export function useBirthdayAgeSignals() {
  const [options, setOptions] = useState<PublicAgeSignalOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/signals/age", { cache: "no-store" });
        const data = (await res.json()) as AgeSignalsResponse;
        if (cancelled) return;
        if (!res.ok) {
          setOptions(null);
          setFetchError("http");
          return;
        }
        const list = Array.isArray(data.options) ? data.options : [];
        setOptions(list.length > 0 ? list : null);
        if (data.error) setFetchError(data.error);
      } catch {
        if (!cancelled) {
          setOptions(null);
          setFetchError("network");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveOptions = useMemo(() => {
    const raw = options && options.length > 0 ? options : FALLBACK_AGE_SIGNAL_OPTIONS;
    const filtered = filterAgeOptionsForBirthdayBuilder(raw);
    if (filtered.length > 0) return filtered;
    return filterAgeOptionsForBirthdayBuilder(FALLBACK_AGE_SIGNAL_OPTIONS);
  }, [options]);

  const isFallback = !options || options.length === 0;

  return {
    options: effectiveOptions,
    rawOptions: options,
    loading,
    fetchError,
    isFallback,
  };
}

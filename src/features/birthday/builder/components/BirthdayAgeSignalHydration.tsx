"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { BirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";
import type { BirthdayAgeSignalsState } from "../hooks/useBirthdayAgeSignals";
import {
  chipLabelForAgeOption,
  mapSignalToBuilderAgeGroup,
} from "../lib/ageSignalMapper";

type BuilderHook = BirthdayBuilderWithGate;

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s/g, "");
}

/**
 * After URL prefill (`?age=`), match taxonomy option and set `selectedAgeSignalId` + label.
 */
export function BirthdayAgeSignalHydration({
  builder,
  signals,
}: {
  builder: BuilderHook;
  signals: BirthdayAgeSignalsState;
}) {
  const searchParams = useSearchParams();
  const { state, setBasics } = builder;
  const { ageGroup, selectedAgeSignalId } = state.quiz;
  const { options, loading } = signals;

  const ageParam = searchParams.get("age");

  const match = useMemo(() => {
    if (!ageGroup || !options.length) return null;
    if (ageParam) {
      const n = norm(ageParam);
      const byValue = options.find((o) => norm(o.value) === n);
      if (byValue && mapSignalToBuilderAgeGroup(byValue) === ageGroup) return byValue;
    }
    return options.find((o) => mapSignalToBuilderAgeGroup(o) === ageGroup) ?? null;
  }, [ageGroup, ageParam, options]);

  useEffect(() => {
    if (loading || !ageGroup || selectedAgeSignalId || !match) return;
    setBasics({
      selectedAgeSignalId: match.id,
      selectedAgeLabel: chipLabelForAgeOption(match),
    });
  }, [loading, ageGroup, selectedAgeSignalId, match, setBasics]);

  return null;
}

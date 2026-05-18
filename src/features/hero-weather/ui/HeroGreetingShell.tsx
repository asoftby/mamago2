"use client";

import { useEffect, useRef } from "react";

import { appendAntiRepeatEntry, loadAntiRepeatState, saveAntiRepeatState } from "../model/anti-repeat-store";
import { normalizeWeatherScenario } from "../model/anti-repeat-types";
import type { HeroGreetingModel } from "../lib/get-hero-context";
import { HeroGreetingErrorBoundary } from "./HeroGreetingErrorBoundary";
import { OptionalWeatherProvider } from "@/components/providers/OptionalWeatherProvider";

export type HeroGreetingShellProps = {
  initialModel: HeroGreetingModel;
};

/**
 * Client shell: renders server-provided hero (no copy mismatch) and persists anti-repeat history after mount.
 * Storage failures never break the page.
 */
export function HeroGreetingShell({ initialModel }: HeroGreetingShellProps) {
  const persistedRef = useRef(false);
  const modelRef = useRef(initialModel);

  useEffect(() => {
    modelRef.current = initialModel;
  }, [initialModel]);

  useEffect(() => {
    if (persistedRef.current) return;
    persistedRef.current = true;

    try {
      const m = modelRef.current;
      const ids = m.debug?.selectedIds;
      if (!ids) return;

      const sig = `${ids.microcopyId}:${ids.titleId}:${ids.subtitleId}`;
      if (typeof window !== "undefined" && window.sessionStorage) {
        const prev = window.sessionStorage.getItem("mamago.hero.persistSig");
        if (prev === sig) return;
      }

      const state = loadAntiRepeatState();
      const next = appendAntiRepeatEntry(state, {
        timestamp: Date.now(),
        scenario: normalizeWeatherScenario(m.weatherScenario),
        microcopyId: ids.microcopyId,
        titleId: ids.titleId,
        subtitleId: ids.subtitleId,
      });
      saveAntiRepeatState(next);

      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("mamago.hero.persistSig", sig);
      }
    } catch {
      // localStorage / private mode / quota
    }
  }, []);

  return (
    <OptionalWeatherProvider>
      <HeroGreetingErrorBoundary model={initialModel} />
    </OptionalWeatherProvider>
  );
}

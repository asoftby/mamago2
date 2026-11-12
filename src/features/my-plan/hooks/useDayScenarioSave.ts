"use client";

import { useCallback, useRef, useState } from "react";
import { buildSaveBody, saveFailureOf, type DraftItem, type SaveFailure } from "../lib/dayScenarioUi/model";

export type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved"; dates: string[] } | { status: "error"; failure: SaveFailure };

/**
 * Saves the shown draft into the plan (POST /api/plan/day-scenario/save). One Idempotency-Key per draft: a retry
 * after a network failure or a double click is the same save on the server; a changed draft gets a fresh key.
 */
export function useDayScenarioSave() {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const keyRef = useRef<{ signature: string; key: string } | null>(null);
  const inFlight = useRef(false);

  const save = useCallback(async (days: readonly { date: string; items: readonly DraftItem[]; keep?: readonly { kind: "event" | "place"; activityId: string }[] }[]): Promise<boolean> => {
    if (inFlight.current) return false;
    const body = buildSaveBody(days);
    const signature = JSON.stringify(body);
    if (keyRef.current?.signature !== signature) keyRef.current = { signature, key: `ds-${crypto.randomUUID()}` };
    inFlight.current = true;
    setState({ status: "saving" });
    try {
      const response = await fetch("/api/plan/day-scenario/save", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": keyRef.current.key },
        body: signature,
      });
      if (response.ok) {
        setState({ status: "saved", dates: days.map((day) => day.date) });
        return true;
      }
      const json = (await response.json().catch(() => null)) as { code?: string } | null;
      setState({ status: "error", failure: saveFailureOf(response.status, json?.code) });
      return false;
    } catch {
      setState({ status: "error", failure: "failed" });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, save, reset };
}

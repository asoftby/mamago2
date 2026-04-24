"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import type { ScenarioStep } from "@/features/me/lib/dayScenario";
import { findPlacement, type ScheduledItem, type PlacementResult } from "@/features/me/lib/dayScheduler";

export type SaveState = "idle" | "saving" | "saved";

export type ConflictInfo = {
  step: ScenarioStep;
  placement: Extract<PlacementResult, { kind: "conflict" }>;
  resolvedStartsAt: Date;
};

export function useAddScenarioPlan() {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  // ── Fetch existing plan items for the day ──────────────────────────────────

  async function fetchDayItems(date: string): Promise<ScheduledItem[]> {
    const res = await fetch(`/api/save/plan/day?date=${date}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: { id: string; title: string | null; startsAt: string | null }) => ({
      id: item.id,
      title: item.title ?? "Событие",
      startsAt: item.startsAt ? new Date(item.startsAt) : new Date(`${date}T09:00:00`),
      durationMin: 60,
    }));
  }

  // ── Save one step ──────────────────────────────────────────────────────────

  async function saveStep(step: ScenarioStep, date: string, startsAt: Date) {
    const res = await fetch("/api/save/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        startsAt: startsAt.toISOString(),
        title: step.title,
        coverImageUrl: step.image,
      }),
    });
    if (!res.ok) throw new Error("save failed");
  }

  // ── Main: smart add scenario ───────────────────────────────────────────────

  const addScenario = async (steps: ScenarioStep[], date: string) => {
    if (steps.length === 0) return;
    setSaveState("saving");
    setConflict(null);

    try {
      const existing = await fetchDayItems(date);

      // Process steps sequentially so each placement sees the previous one
      const placed: ScheduledItem[] = [...existing];

      for (const step of steps) {
        const preferred = new Date(`${date}T${step.time}:00`);
        const result = findPlacement(placed, preferred);

        if (result.kind === "no_space") {
          setSaveState("idle");
          toast.error("Не нашли место в этом дне");
          return;
        }

        if (result.kind === "conflict") {
          // Pause and ask user
          setSaveState("idle");
          setConflict({ step, placement: result, resolvedStartsAt: result.startsAt });
          return;
        }

        // Free — save immediately
        await saveStep(step, date, result.startsAt);
        placed.push({ id: `new-${step.id}`, title: step.title, startsAt: result.startsAt, durationMin: 60 });
      }

      setSaveState("saved");
      toast.success("Готово ✨ День добавлен в план");
    } catch {
      setSaveState("idle");
      toast.error("Не удалось сохранить план");
    }
  };

  // ── Confirm conflict resolution ────────────────────────────────────────────

  const confirmConflict = async (date: string) => {
    if (!conflict) return;
    setSaveState("saving");
    try {
      await saveStep(conflict.step, date, conflict.resolvedStartsAt);
      setConflict(null);
      setSaveState("saved");
      toast.success("План обновлён");
    } catch {
      setSaveState("idle");
      toast.error("Не удалось сохранить");
    }
  };

  const dismissConflict = () => setConflict(null);

  return { addScenario, confirmConflict, dismissConflict, saveState, conflict };
}

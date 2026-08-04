"use client";

import { useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { toggleAgeRangeSelection } from "../lib/ageRangeSelection";
import { MAX_SELECTED_AGE_RANGES } from "../lib/resolveDefaultParticipants";

const KID_AGE_GROUPS = AGE_GROUPS.filter((g) => g.value !== "18+");

interface PlanNeedsAgeQuestionProps {
  onConfirm: (ageRanges: string[]) => void;
  onCancel: () => void;
  compact?: boolean;
}

/**
 * Единственный уточняющий вопрос слоя 0, когда в профиле нет ни одного ребёнка
 * и ещё не было сохранённого состава — не блок, не форма, до 3 диапазонов возраста
 * (выбор четвёртого вытесняет первый, см. toggleAgeRangeSelection).
 */
export function PlanNeedsAgeQuestion({ onConfirm, onCancel, compact = false }: PlanNeedsAgeQuestionProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const items: ChipItem[] = KID_AGE_GROUPS.map((g) => ({
    id: g.value,
    label: g.label,
    active: selected.includes(g.value),
    onClick: () => setSelected((prev) => toggleAgeRangeSelection(prev, g.value)),
  }));

  return (
    <section className={compact ? "space-y-2" : "space-y-3"} aria-label="Возраст детей">
      <div>
        <h3
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: compact ? 16 : 18,
            fontWeight: 600,
            lineHeight: 1.15,
            color: "#141210",
          }}
        >
          Сколько лет детям?
        </h3>
        <p className="mt-1 text-sm text-neutral-500">До {MAX_SELECTED_AGE_RANGES} возрастов</p>
      </div>
      <ChipsRow items={items} layout="wrap" aria-label="Возраст детей" />
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
          className="rounded-full bg-[#EF8759] px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Готово
        </button>
      </div>
    </section>
  );
}

"use client";

import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

const KID_AGE_GROUPS = AGE_GROUPS.filter((g) => g.value !== "18+");

interface PlanNeedsAgeQuestionProps {
  onSelect: (ageGroupValue: string) => void;
  onCancel: () => void;
  compact?: boolean;
}

/**
 * Единственный уточняющий вопрос слоя 0, когда в профиле нет ни одного ребёнка
 * и ещё не было сохранённого состава — не блок, не форма, один выбор возраста.
 */
export function PlanNeedsAgeQuestion({ onSelect, onCancel, compact = false }: PlanNeedsAgeQuestionProps) {
  const items: ChipItem[] = KID_AGE_GROUPS.map((g) => ({
    id: g.value,
    label: g.label,
    onClick: () => onSelect(g.value),
  }));

  return (
    <section className={compact ? "space-y-2" : "space-y-3"} aria-label="Возраст ребёнка">
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
          Сколько лет ребёнку?
        </h3>
        <p className="mt-1 text-sm text-neutral-500">Чтобы подобрать идеи по возрасту</p>
      </div>
      <ChipsRow items={items} layout="wrap" aria-label="Возраст ребёнка" />
      <button
        type="button"
        onClick={onCancel}
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
      >
        Назад
      </button>
    </section>
  );
}

"use client";

import type { BirthdayBudgetGroup } from "../../../types/birthday";
import { BirthdayOptionCard } from "../../cards/BirthdayOptionCard";

const OPTIONS: { value: BirthdayBudgetGroup; emoji: string; label: string; sublabel: string }[] = [
  { value: "up300", emoji: "💚", label: "До 300 BYN", sublabel: "Бюджетный вариант" },
  { value: "300-600", emoji: "💛", label: "300–600 BYN", sublabel: "Оптимальный выбор" },
  { value: "600-1000", emoji: "🧡", label: "600–1000 BYN", sublabel: "Насыщенная программа" },
  { value: "1000plus", emoji: "💎", label: "1000+ BYN", sublabel: "Праздник без ограничений" },
  { value: "unknown", emoji: "🤷", label: "Пока не знаю", sublabel: "Покажите все варианты" },
];

interface StepBudgetProps {
  value: BirthdayBudgetGroup | null;
  onChange: (v: BirthdayBudgetGroup) => void;
}

export function StepBudget({ value, onChange }: StepBudgetProps) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((opt) => (
        <BirthdayOptionCard
          key={opt.value}
          emoji={opt.emoji}
          label={opt.label}
          sublabel={opt.sublabel}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}

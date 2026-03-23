"use client";

import type { BirthdayFormatChoice } from "../../../types/birthday";
import { BirthdayOptionCard } from "../../cards/BirthdayOptionCard";

const OPTIONS: { value: BirthdayFormatChoice; emoji: string; label: string; sublabel: string }[] = [
  { value: "HOME", emoji: "🏠", label: "Дома", sublabel: "Уютно, своя атмосфера" },
  { value: "VENUE", emoji: "🎪", label: "В заведении", sublabel: "Кафе, клуб, игровая комната" },
  { value: "OUTDOOR", emoji: "🌳", label: "На природе", sublabel: "Парк, загородная площадка" },
  { value: "unknown", emoji: "🤔", label: "Пока не знаю", sublabel: "Покажите все варианты" },
];

interface StepFormatProps {
  value: BirthdayFormatChoice | null;
  onChange: (v: BirthdayFormatChoice) => void;
}

export function StepFormat({ value, onChange }: StepFormatProps) {
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

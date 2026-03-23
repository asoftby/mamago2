"use client";

import type { BirthdayAgeGroup } from "../../../types/birthday";
import { BirthdayOptionCard } from "../../cards/BirthdayOptionCard";

const OPTIONS: { value: BirthdayAgeGroup; emoji: string; label: string; sublabel: string }[] = [
  { value: "0-3", emoji: "👶", label: "0–3 года", sublabel: "Малыши, первые праздники" },
  { value: "3-5", emoji: "🧒", label: "3–5 лет", sublabel: "Активные и любопытные" },
  { value: "5-8", emoji: "🎒", label: "5–8 лет", sublabel: "Школьники, квесты и шоу" },
  { value: "8-12", emoji: "🎮", label: "8–12 лет", sublabel: "Подростки, интересные форматы" },
];

interface StepAgeProps {
  value: BirthdayAgeGroup | null;
  onChange: (v: BirthdayAgeGroup) => void;
}

export function StepAge({ value, onChange }: StepAgeProps) {
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

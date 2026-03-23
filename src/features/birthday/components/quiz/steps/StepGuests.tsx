"use client";

import type { BirthdayGuestsGroup } from "../../../types/birthday";
import { BirthdayOptionCard } from "../../cards/BirthdayOptionCard";

const OPTIONS: { value: BirthdayGuestsGroup; emoji: string; label: string; sublabel: string }[] = [
  { value: "up5", emoji: "👪", label: "До 5 детей", sublabel: "Камерный праздник" },
  { value: "5-10", emoji: "👫", label: "5–10 детей", sublabel: "Небольшая компания" },
  { value: "10-15", emoji: "🎉", label: "10–15 детей", sublabel: "Весёлая группа" },
  { value: "15plus", emoji: "🎊", label: "15 и больше", sublabel: "Большой праздник" },
];

interface StepGuestsProps {
  value: BirthdayGuestsGroup | null;
  onChange: (v: BirthdayGuestsGroup) => void;
}

export function StepGuests({ value, onChange }: StepGuestsProps) {
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

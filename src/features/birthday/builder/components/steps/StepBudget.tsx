"use client";

import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BirthdayOptionCard } from "../../../components/cards/BirthdayOptionCard";
import { BuilderProgress } from "../BuilderProgress";

type BuilderHook = BirthdayBuilderWithGate;

const BUDGET_OPTIONS = [
  { value: "up300" as const, emoji: "💚", label: "До 300 BYN" },
  { value: "300-600" as const, emoji: "💛", label: "300–600 BYN" },
  { value: "600-1000" as const, emoji: "🧡", label: "600–1000 BYN" },
  { value: "1000plus" as const, emoji: "💎", label: "1000+ BYN" },
];

export function StepBudget({ builder }: { builder: BuilderHook }) {
  const { state, setBasics } = builder;
  const { budgetGroup } = state.quiz;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground/85">
            Какой бюджет?
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Подберите предложения под ваш бюджет
          </p>
        </div>
        <BuilderProgress currentStep="budget" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3">
          {BUDGET_OPTIONS.map((opt) => (
            <BirthdayOptionCard
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={budgetGroup === opt.value}
              onClick={() => setBasics({ budgetGroup: opt.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

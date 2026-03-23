"use client";

import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BirthdayOptionCard } from "../../../components/cards/BirthdayOptionCard";
import { BuilderProgress } from "../BuilderProgress";

type BuilderHook = BirthdayBuilderWithGate;

const GUESTS_OPTIONS = [
  { value: "up5" as const, emoji: "👪", label: "До 5 детей" },
  { value: "5-10" as const, emoji: "👫", label: "5–10 детей" },
  { value: "10-15" as const, emoji: "🎉", label: "10–15 детей" },
  { value: "15plus" as const, emoji: "🎊", label: "15+ детей" },
];

export function StepExtras({ builder }: { builder: BuilderHook }) {
  const { state, setBasics } = builder;
  const { guestsGroup } = state.quiz;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground/85">
            Сколько детей?
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Поможет точнее подобрать праздник
          </p>
        </div>
        <BuilderProgress currentStep="extras" />
      </div>

      <div className="space-y-6 rounded-xl border border-border/40 bg-muted/20 px-3 py-4 sm:px-4 sm:py-5">
        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-muted-foreground tracking-wide">
            Сколько детей придёт?
          </h3>
          <div className="flex flex-col gap-2">
            {GUESTS_OPTIONS.map((opt) => (
              <BirthdayOptionCard
                key={opt.value}
                emoji={opt.emoji}
                label={opt.label}
                selected={guestsGroup === opt.value}
                onClick={() => setBasics({ guestsGroup: opt.value })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

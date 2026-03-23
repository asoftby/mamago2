"use client";

import type { BirthdayQuizState } from "../../types/birthday";
import { cn } from "@/lib/utils";

const AGE_LABELS: Record<string, string> = {
  "0-3": "0–3 года",
  "3-5": "3–5 лет",
  "5-8": "5–8 лет",
  "8-12": "8–12 лет",
};
const FORMAT_LABELS: Record<string, string> = {
  HOME: "Дома",
  VENUE: "В заведении",
  OUTDOOR: "На природе",
  unknown: "Любой формат",
};
const GUESTS_LABELS: Record<string, string> = {
  up5: "до 5 детей",
  "5-10": "5–10 детей",
  "10-15": "10–15 детей",
  "15plus": "15+ детей",
};
const BUDGET_LABELS: Record<string, string> = {
  up300: "до 300 BYN",
  "300-600": "300–600 BYN",
  "600-1000": "600–1000 BYN",
  "1000plus": "1000+ BYN",
  unknown: "Бюджет открыт",
};

interface BirthdayStickySummaryProps {
  state: BirthdayQuizState;
  totalCount: number;
  canGoNext: boolean;
  onNext: () => void;
  onViewResults: () => void;
  currentStep: number;
  totalSteps: number;
}

export function BirthdayStickySummary({
  state,
  totalCount,
  canGoNext,
  onNext,
  onViewResults,
  currentStep,
  totalSteps,
}: BirthdayStickySummaryProps) {
  const isLastStep = currentStep === totalSteps;
  const chips = [
    state.ageGroup && AGE_LABELS[state.ageGroup],
    state.format && FORMAT_LABELS[state.format],
    state.guestsGroup && GUESTS_LABELS[state.guestsGroup],
    state.budgetGroup && BUDGET_LABELS[state.budgetGroup],
  ].filter(Boolean) as string[];

  return (
    <>
      {/* Desktop: sticky sidebar card */}
      <div className="hidden lg:block sticky top-6 space-y-4">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4">
          <div className="text-sm font-semibold text-foreground">Ваш выбор</div>

          {chips.length === 0 ? (
            <p className="text-sm text-muted-foreground">Начните выбирать параметры</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="text-xs bg-orange-50 text-[#EF8759] border border-orange-200 rounded-full px-3 py-1 font-medium">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {totalCount > 0 && (
            <div className="text-sm text-muted-foreground">
              Найдено <span className="font-semibold text-foreground">{totalCount}</span> предложений
            </div>
          )}

          <button
            type="button"
            disabled={!canGoNext}
            onClick={isLastStep ? onViewResults : onNext}
            className={cn(
              "w-full rounded-xl py-3 text-sm font-semibold transition-all",
              canGoNext
                ? "bg-[#EF8759] text-white hover:bg-[#e07848]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLastStep ? "Смотреть подборку" : "Далее"}
          </button>
        </div>
      </div>

      {/* Mobile: fixed bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip} className="text-[11px] bg-orange-50 text-[#EF8759] border border-orange-200 rounded-full px-2 py-0.5 font-medium">
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Выберите параметры</span>
          )}
          {totalCount > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {totalCount} предложений
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={isLastStep ? onViewResults : onNext}
          className={cn(
            "shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
            canGoNext
              ? "bg-[#EF8759] text-white hover:bg-[#e07848]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isLastStep ? "Смотреть" : "Далее"}
        </button>
      </div>
    </>
  );
}

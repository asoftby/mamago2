"use client";

import type { BirthdayOffer, BirthdayQuizState } from "../../types/birthday";
import { BirthdayOfferCard } from "../cards/BirthdayOfferCard";
import { groupBirthdayCandidates } from "../../lib/groupBirthdayCandidates";
import { getBudgetEstimate, formatBudget } from "../../lib/getBudgetEstimate";
import { CheckCircle2, RotateCcw } from "lucide-react";

const AGE_LABELS: Record<string, string> = {
  "0-3": "0–3 года", "3-5": "3–5 лет", "5-8": "5–8 лет", "8-12": "8–12 лет",
};
const FORMAT_LABELS: Record<string, string> = {
  HOME: "Дома", VENUE: "В заведении", OUTDOOR: "На природе", unknown: "Любой формат",
};
const GUESTS_LABELS: Record<string, string> = {
  up5: "до 5 детей", "5-10": "5–10 детей", "10-15": "10–15 детей", "15plus": "15+ детей",
};
const BUDGET_LABELS: Record<string, string> = {
  up300: "до 300 BYN", "300-600": "300–600 BYN", "600-1000": "600–1000 BYN",
  "1000plus": "1000+ BYN", unknown: "Бюджет открыт",
};

interface BirthdayResultsPageProps {
  state: BirthdayQuizState;
  filteredOffers: BirthdayOffer[];
  onReset: () => void;
}

export function BirthdayResultsPage({ state, filteredOffers, onReset }: BirthdayResultsPageProps) {
  const groups = groupBirthdayCandidates(filteredOffers);
  const estimate = getBudgetEstimate(filteredOffers, state.budgetGroup);

  const params = [
    state.ageGroup && AGE_LABELS[state.ageGroup],
    state.format && FORMAT_LABELS[state.format],
    state.guestsGroup && GUESTS_LABELS[state.guestsGroup],
    state.budgetGroup && BUDGET_LABELS[state.budgetGroup],
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8 pb-24 lg:pb-8">
      {/* Summary header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#EF8759]" />
          <h2 className="text-xl font-semibold text-foreground">Ваша подборка готова</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {params.map((p) => (
            <span key={p} className="text-xs bg-orange-50 text-[#EF8759] border border-orange-200 rounded-full px-3 py-1 font-medium">
              {p}
            </span>
          ))}
        </div>
        {estimate && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 text-sm">
            <span className="text-muted-foreground">Примерный старт бюджета: </span>
            <span className="font-semibold text-foreground">{formatBudget(estimate)}</span>
          </div>
        )}
      </div>

      {/* Offer groups */}
      {groups.map((group) => (
        <div key={group.label} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.offers.map((offer) => (
              <BirthdayOfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      ))}

      {/* CTAs */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          className="w-full rounded-2xl bg-[#EF8759] text-white font-semibold py-4 text-base hover:bg-[#e07848] transition-colors"
        >
          Собрать мой ДР
        </button>
        <button
          type="button"
          className="w-full rounded-2xl border border-border font-semibold py-3.5 text-sm hover:bg-muted/50 transition-colors"
        >
          Сохранить подборку
        </button>
        <button
          type="button"
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Начать заново
        </button>
      </div>
    </div>
  );
}

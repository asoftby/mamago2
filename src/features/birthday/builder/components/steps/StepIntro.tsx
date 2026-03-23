"use client";

import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import type { BirthdayAgeSignalsState } from "../../hooks/useBirthdayAgeSignals";
import {
  mapSignalToBuilderAgeGroup,
  chipLabelForAgeOption,
  type PublicAgeSignalOption,
} from "../../lib/ageSignalMapper";
import { BuilderProgress } from "../BuilderProgress";
import { PartyForChildSection } from "../PartyForChildSection";
import { cn } from "@/lib/utils";

type BuilderHook = BirthdayBuilderWithGate;

interface StepIntroProps {
  builder: BuilderHook;
  signals: BirthdayAgeSignalsState;
}

export function StepIntro({ builder, signals }: StepIntroProps) {
  const { setBasics, state } = builder;
  const { options, loading, isFallback, fetchError } = signals;
  const selectedId = state.quiz.selectedAgeSignalId;
  const hasSelectedChild = Boolean(state.quiz.partyForChild);

  const handleAgeSelect = (opt: PublicAgeSignalOption) => {
    const ageGroup = mapSignalToBuilderAgeGroup(opt);
    setBasics({
      ageGroup,
      selectedAgeSignalId: opt.id,
      selectedAgeLabel: chipLabelForAgeOption(opt),
    });
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
        <div className="text-center space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
            Организовать детский<br />день рождения
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)] mx-auto">
            Пошагово подберём формат, место и услуги
          </p>
          <div className="flex justify-center">
            <BuilderProgress currentStep="intro" />
          </div>
        </div>

        <PartyForChildSection builder={builder} ageSignals={signals} />

        {/* Возраст из даты рождения выбранного ребёнка — чипы не показываем (конфликт данных) */}
        {!hasSelectedChild && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Сколько лет ребёнку?</h2>

            {fetchError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Не удалось загрузить возраст из каталога. Показаны запасные варианты.
              </p>
            )}
            {isFallback && !loading && !fetchError && (
              <p className="text-xs text-muted-foreground">
                Каталог возраста пуст — показаны стандартные варианты.
              </p>
            )}

            <div className="flex flex-wrap gap-2 min-h-[48px]">
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 w-[72px] rounded-xl border-2 border-border bg-muted/40 animate-pulse"
                    />
                  ))}
                </>
              ) : (
                options.map((opt) => {
                  const isSelected = selectedId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleAgeSelect(opt)}
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ease-out",
                        "active:scale-[0.97]",
                        isSelected
                          ? "bg-[#EF8759] text-white shadow-sm"
                          : "border-2 border-border bg-white text-foreground hover:border-[#EF8759]/60 hover:bg-orange-50/50"
                      )}
                    >
                      {chipLabelForAgeOption(opt)}
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Можно пропустить — подберём универсальные варианты
            </p>
          </div>
        )}

        <ul className="space-y-1.5 pt-2 text-sm text-muted-foreground">
          <li>• площадки</li>
          <li>• аниматоры</li>
          <li>• вкусная еда, торты и сладости</li>
          <li>• красивый декор</li>
          <li>• готовые пакеты</li>
        </ul>
      </div>
    </div>
  );
}

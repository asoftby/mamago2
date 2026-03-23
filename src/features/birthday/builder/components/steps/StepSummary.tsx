"use client";

import { useMemo } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BirthdayOfferCard } from "../../../components/cards/BirthdayOfferCard";
import { BudgetBar } from "../BudgetBar";
import { BuilderProgress } from "../BuilderProgress";
import { CheckCircle2, AlertCircle, Trash2, Home, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { generatePersonalRecommendation } from "../../lib/offerPersonalRecommendation";

type BuilderHook = BirthdayBuilderWithGate;

export function StepSummary({ builder }: { builder: BuilderHook }) {
  const {
    state,
    selectedBase,
    selectedAddons,
    removeSelectedOffer,
    goToStep,
    resetBuilder,
  } = builder;
  const { currentStep } = state.ui;
  const { conflicts } = state.validation;
  const { placeType, partyForChild, theme } = state.quiz;

  const conflictIds = useMemo(() => new Set(conflicts.map((c) => c.offerId)), [conflicts]);
  const validOffers = useMemo(
    () =>
      [selectedBase, ...selectedAddons]
        .filter((o): o is NonNullable<typeof o> => o != null && !conflictIds.has(o.id)),
    [selectedBase, selectedAddons, conflictIds]
  );
  const totalPrice = useMemo(
    () => validOffers.reduce((sum, o) => sum + (o.priceFrom ?? 0), 0),
    [validOffers]
  );

  const hasConflicts = conflicts.length > 0;

  const isVirtualBase = (placeType === "HOME" || placeType === "OUTDOOR") && !selectedBase;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[#EF8759]"
              aria-hidden
            />
            <h2 className="text-lg font-medium text-foreground/85">
              Ваш праздник готов
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Проверьте и отправьте заявки
          </p>
        </div>
        <BuilderProgress currentStep={currentStep} />
      </div>

      {/* Conflicts banner */}
      {hasConflicts && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#EF8759] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Есть несовместимые предложения</p>
            <p className="text-xs text-muted-foreground mt-1">
              Удалите их или измените площадку
            </p>
            <div className="mt-2 space-y-1">
              {conflicts.map((c) => (
                <div key={c.offerId} className="text-xs text-muted-foreground">
                  • {c.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Base: venue/package or virtual (HOME/OUTDOOR) */}
      {selectedBase && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Где празднуем?</h3>
          <div className="relative">
            <BirthdayOfferCard
              offer={selectedBase}
              hideRequestCta
              recommendation={generatePersonalRecommendation(selectedBase, {
                partyForChild,
                theme,
              })}
            />
            <button
              onClick={() => removeSelectedOffer(selectedBase.id)}
              className="absolute top-3 right-3 rounded-lg bg-white border border-border p-2 hover:bg-red-50 hover:border-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Virtual base: HOME or OUTDOOR format (no venue selected) */}
      {isVirtualBase && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Где празднуем?</h3>
          <div
            className={cn(
              "relative rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-6",
              "flex items-center gap-4"
            )}
          >
            {placeType === "HOME" ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                <Home className="h-6 w-6 text-[#EF8759]" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                <Trees className="h-6 w-6 text-[#EF8759]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {placeType === "HOME" ? "Праздник дома" : "Праздник на природе"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {placeType === "HOME"
                  ? "Услуги можно заказать на дом"
                  : "Услуги для праздника за городом"}
              </p>
            </div>
            <button
              onClick={() => goToStep("place")}
              className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Изменить
            </button>
          </div>
        </div>
      )}

      {/* Addons */}
      {selectedAddons.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Дополнительно</h3>
          <div className="space-y-3">
            {selectedAddons.map((addon) => {
              const isConflicted = conflicts.some((c) => c.offerId === addon.id);
              return (
                <div
                  key={addon.id}
                  className={cn(
                    "relative",
                    isConflicted && "opacity-60 ring-2 ring-red-500 ring-offset-2 rounded-2xl"
                  )}
                >
                  <BirthdayOfferCard
                    offer={addon}
                    compact
                    wide
                    recommendation={generatePersonalRecommendation(addon, {
                      partyForChild,
                      theme,
                    })}
                  />
                  <button
                    onClick={() => removeSelectedOffer(addon.id)}
                    className="absolute top-3 right-3 rounded-lg bg-white border border-border p-2 hover:bg-red-50 hover:border-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {isConflicted && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Конфликт
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget */}
      {(state.quiz.budgetGroup && state.quiz.budgetGroup !== "unknown") && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Бюджет</h3>
          <BudgetBar
            totalPrice={totalPrice}
            budgetGroup={state.quiz.budgetGroup}
            offers={validOffers}
            variant="expanded"
          />
        </div>
      )}

      {/* Вторичные действия — основной переход в sticky bar */}
      <div className="space-y-3">
        <button
          onClick={() => goToStep("place")}
          className="w-full rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
        >
          Изменить площадку
        </button>
        <button
          onClick={resetBuilder}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Начать заново
        </button>
      </div>
    </div>
  );
}

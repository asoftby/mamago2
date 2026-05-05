"use client";

import { useState, useMemo } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BirthdayOfferCard } from "../../../components/cards/BirthdayOfferCard";
import { OfferQuickView } from "../OfferQuickView";
import { birthdayOffers } from "../../../data/birthdayOffers";
import { filterBirthdayOffers } from "../../../lib/filterBirthdayOffers";
import { rankBirthdayOffers } from "../../../lib/rankBirthdayOffers";
import { isVenueBoundAddon } from "../../lib/compatibility";
import { checkAddonCompatibility } from "../../lib/compatibility";
import { AddRemoveButton } from "../AddRemoveButton";
import { BuilderProgress } from "../BuilderProgress";
import { AlertCircle, Sparkles, Eye } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { OfferLayer } from "../../../types/birthday";
import { generatePersonalRecommendation } from "../../lib/offerPersonalRecommendation";

type BuilderHook = BirthdayBuilderWithGate;

const STEP_CONFIG: Record<string, { title: string; subtitle: string; layer: OfferLayer }> = {
  entertainment: {
    title: "Развлечения",
    subtitle: "Аниматоры, шоу, мастер-классы",
    layer: "ENTERTAINMENT",
  },
  food: {
    title: "Еда и торты",
    subtitle: "Торты, candy bar, угощения",
    layer: "FOOD",
  },
  decor: {
    title: "Декор и допуслуги",
    subtitle: "Шары, фотозона, аквагрим",
    layer: "DECOR",
  },
};

export function StepAddons({ builder }: { builder: BuilderHook }) {
  const [quickViewOfferId, setQuickViewOfferId] = useState<string | null>(null);
  const { state, toggleAddon, selectedAddons, selectedBase } = builder;
  const { currentStep } = state.ui;
  const { ageGroup, budgetGroup, guestsGroup, placeType, partyForChild, theme } =
    state.quiz;
  const { selectedAddonIds } = state.selection;
  const { conflicts } = state.validation;

  const config = STEP_CONFIG[currentStep] || STEP_CONFIG.entertainment;

  // Filter addons by layer + quiz inputs (soft filtering), exclude incompatible
  const { recommendedOffers, otherOffers, allOffers } = useMemo(() => {
    const byLayer = birthdayOffers.filter((o) => o.layer === config.layer);
    const format =
      placeType === "HOME" || placeType === "OUTDOOR" || placeType === "VENUE"
        ? (placeType as "HOME" | "VENUE" | "OUTDOOR")
        : undefined;
    const filtered = filterBirthdayOffers(byLayer, {
      ageGroup: ageGroup ?? undefined,
      format: format ?? undefined,
      guestsGroup: guestsGroup ?? undefined,
      budgetGroup: budgetGroup ?? undefined,
    });

    // Exclude incompatible with current base/format
    const compatible = filtered.filter(
      (o) => !checkAddonCompatibility(o, selectedBase ?? null, placeType)
    );

    const interestSlugs = partyForChild?.interestSlugs;
    const compatibleRanked = rankBirthdayOffers(compatible, {
      interestSlugs: interestSlugs?.length ? interestSlugs : undefined,
    });

    const hasVenue = placeType === "VENUE" && selectedBase;

    if (hasVenue && selectedBase) {
      const recommended = compatibleRanked.filter((o) => isVenueBoundAddon(o, selectedBase));
      const other = compatibleRanked.filter((o) => !isVenueBoundAddon(o, selectedBase));
      return { recommendedOffers: recommended, otherOffers: other, allOffers: compatibleRanked };
    }

    return { recommendedOffers: [], otherOffers: compatibleRanked, allOffers: compatibleRanked };
  }, [config.layer, ageGroup, budgetGroup, guestsGroup, placeType, selectedBase, partyForChild?.interestSlugs]);

  const hasConflicts = conflicts.length > 0;
  const hasVenueRecommended = placeType === "VENUE" && selectedBase && recommendedOffers.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-medium text-foreground/85">
            {config.title}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            {config.subtitle}
          </p>
        </div>
        <BuilderProgress currentStep={currentStep} />
      </div>

      {/* Conflicts banner */}
      {hasConflicts && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#EF8759] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Некоторые предложения несовместимы с выбранной площадкой
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Вы можете удалить их или выбрать другую площадку
            </p>
          </div>
        </div>
      )}

      {/* Addons */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold">Выберите что нужно</h3>

        {hasVenueRecommended && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#EF8759]" />
              <h4 className="text-sm font-semibold text-foreground">
                Рекомендуем для выбранного места
              </h4>
            </div>
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/30 p-4">
              <div className="flex flex-col gap-4">
                {recommendedOffers.map((offer) => {
                  const isSelected = selectedAddonIds.includes(offer.id);
                  const isConflicted = conflicts.some((c) => c.offerId === offer.id);

                  return (
                    <div
                      key={offer.id}
                      className={cn(
                        "relative rounded-2xl transition-all group",
                        isSelected && !isConflicted && "border-[#EF8759]/60 bg-orange-50/20",
                        isConflicted && "ring-2 ring-red-500 ring-offset-2 opacity-60"
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setQuickViewOfferId(offer.id)}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") && setQuickViewOfferId(offer.id)
                        }
                        className="cursor-pointer"
                      >
                        <BirthdayOfferCard
                          offer={offer}
                          compact
                          wide
                          recommendation={generatePersonalRecommendation(offer, {
                            partyForChild,
                            theme,
                          })}
                        />
                      </div>
                      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewOfferId(offer.id);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-gray-50"
                        >
                          <Eye className="h-3 w-3 shrink-0" />
                          Подробнее
                        </button>
                        <AddRemoveButton
                          selected={isSelected}
                          conflict={isConflicted}
                          onClick={() => {
                            const wasSelected = isSelected;
                            toggleAddon(offer.id);
                            if (!wasSelected) toast.success("Добавлено в праздник");
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {hasVenueRecommended && otherOffers.length > 0 && (
            <h4 className="text-sm font-semibold text-muted-foreground">
              Другие варианты
            </h4>
          )}
          {!hasVenueRecommended && otherOffers.length === 0 && allOffers.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Нет подходящих предложений для выбранных параметров
            </p>
          )}
          <div className="flex flex-col gap-4">
            {otherOffers.map((offer) => {
              const isSelected = selectedAddonIds.includes(offer.id);
              const isConflicted = conflicts.some((c) => c.offerId === offer.id);

              return (
                <div
                  key={offer.id}
                  className={cn(
                    "relative rounded-2xl transition-all",
                    isSelected && !isConflicted && "border-[#EF8759]/60 bg-orange-50/20",
                    isConflicted && "ring-2 ring-red-500 ring-offset-2 opacity-60"
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setQuickViewOfferId(offer.id)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && setQuickViewOfferId(offer.id)
                    }
                    className="cursor-pointer"
                  >
                    <BirthdayOfferCard
                      offer={offer}
                      compact
                      wide
                      recommendation={generatePersonalRecommendation(offer, {
                        partyForChild,
                        theme,
                      })}
                    />
                  </div>
                  <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewOfferId(offer.id);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 shrink-0" />
                      Подробнее
                    </button>
                    <AddRemoveButton
                      selected={isSelected}
                      conflict={isConflicted}
                      onClick={() => {
                        const wasSelected = isSelected;
                        toggleAddon(offer.id);
                        if (!wasSelected) toast.success("Добавлено в праздник");
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <OfferQuickView
        open={!!quickViewOfferId}
        onClose={() => setQuickViewOfferId(null)}
        offer={
          quickViewOfferId ? allOffers.find((o) => o.id === quickViewOfferId) ?? null : null
        }
        builder={builder}
      />
    </div>
  );
}

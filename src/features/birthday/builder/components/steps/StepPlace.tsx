"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BirthdayOptionCard } from "../../../components/cards/BirthdayOptionCard";
import { OfferQuickView } from "../OfferQuickView";
import { mockBirthdayOffers } from "../../../data/mockBirthdayOffers";
import { filterBirthdayOffers } from "../../../lib/filterBirthdayOffers";
import { isVenueBoundAddon, checkAddonCompatibility } from "../../lib/compatibility";
import { AddRemoveButton } from "../AddRemoveButton";
import { BuilderProgress } from "../BuilderProgress";
import {
  generatePersonalRecommendation,
  personalRecommendationAria,
} from "../../lib/offerPersonalRecommendation";
import { OfferRecommendationBlock } from "../../../components/OfferRecommendationBlock";
import { formatConcreteOfferPrice } from "../../../lib/formatOfferPrice";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BuilderHook = BirthdayBuilderWithGate;

const PLACE_TYPE_OPTIONS = [
  { value: "HOME" as const, emoji: "🏠", label: "Дома", sublabel: "Уютно" },
  { value: "VENUE" as const, emoji: "🎪", label: "В заведении", sublabel: "Готовая площадка" },
  { value: "OUTDOOR" as const, emoji: "🌳", label: "На природе", sublabel: "Загородный формат" },
];

/** Human-readable labels for venue includes */
const VENUE_INCLUDES_LABELS: Record<string, string> = {
  animator: "Аниматор",
  cake: "Торты / сладости",
  decor: "Декор",
  venue_access: "Аренда зала",
  playground: "Игровая зона",
  soft_zones: "Мягкие зоны",
  masterclass: "Мастер-класс",
  food: "Еда / меню",
  photo: "Фотограф",
};

export function StepPlace({ builder }: { builder: BuilderHook }) {
  const [quickViewOfferId, setQuickViewOfferId] = useState<string | null>(null);
  const { state, setPlaceType, selectBase, toggleAddon, selectedBase } = builder;
  const { placeType, ageGroup, budgetGroup, guestsGroup, theme, partyForChild } =
    state.quiz;
  const { selectedBaseId, selectedAddonIds } = state.selection;

  // Filter base offers by placeType + quiz inputs (soft filtering)
  const baseOffers = useMemo(() => {
    if (!placeType || placeType !== "VENUE") return [];

    const venueOffers = mockBirthdayOffers.filter(
      (o) => o.layer === "BASE" && o.formatTags?.includes("VENUE")
    );
    const filtered = filterBirthdayOffers(venueOffers, {
      ageGroup: ageGroup ?? undefined,
      format: "VENUE",
      guestsGroup: guestsGroup ?? undefined,
      budgetGroup: budgetGroup ?? undefined,
    });
    return filtered.slice(0, 8);
  }, [placeType, ageGroup, budgetGroup, guestsGroup]);

  // For HOME/OUTDOOR: can proceed once placeType is selected
  // For VENUE: need both placeType AND selectedBaseId
  const canProceed = placeType === "HOME" || placeType === "OUTDOOR" 
    ? placeType !== null 
    : selectedBaseId !== null;

  const showVenueList = placeType === "VENUE";

  // Venue-bound addons for "Быстро добавить" (2-3 offers)
  const quickAddOffers = useMemo(() => {
    if (!selectedBase || placeType !== "VENUE") return [];

    const addons = mockBirthdayOffers.filter(
      (o) => o.layer !== "BASE" && isVenueBoundAddon(o, selectedBase)
    );

    return addons
      .filter((o) => !checkAddonCompatibility(o, selectedBase, placeType))
      .slice(0, 5);
  }, [selectedBase, placeType]);

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground/85">
            Где отмечать?
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Выберите формат и площадку
          </p>
        </div>
        <BuilderProgress currentStep="place" />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Формат праздника</h3>
        <div className="flex flex-col gap-3">
          {PLACE_TYPE_OPTIONS.map((opt) => (
            <BirthdayOptionCard
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              sublabel={opt.sublabel}
              selected={placeType === opt.value}
              onClick={() => setPlaceType(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Venue list - only for VENUE format, 1 card per row */}
      {showVenueList && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Выберите площадку</h3>
          <div className="flex flex-col gap-5">
            {baseOffers.map((offer) => {
              const isSelected = selectedBaseId === offer.id;
              const hasVenueIncludes = offer.venueIncludes && offer.venueIncludes.length > 0;
              const offersForThisVenue = isSelected ? quickAddOffers : [];
              const basePriceLine = formatConcreteOfferPrice(offer);
              const baseRec = generatePersonalRecommendation(offer, {
                partyForChild,
                theme,
              });

              return (
                <div
                  key={offer.id}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden transition-all relative",
                    isSelected
                      ? "border-[#EF8759]/60 bg-orange-50/20"
                      : "border-black/[0.06] hover:shadow-md hover:border-black/[0.08]"
                  )}
                >
                  {/* Top: image + main content */}
                  <div
                    className="flex flex-col sm:flex-row cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setQuickViewOfferId(offer.id)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && setQuickViewOfferId(offer.id)
                    }
                  >
                    {/* Image — left */}
                    <div className="relative shrink-0 w-full sm:w-44 md:w-52 h-36 sm:h-auto sm:min-h-[160px] bg-muted">
                      <Image
                        src={offer.image}
                        alt={offer.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 208px"
                      />
                      {offer.isFeatured && (
                        <span className="absolute top-3 left-3 bg-[#EF8759] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          Топ
                        </span>
                      )}
                    </div>

                    {/* Content — right */}
                    <div
                      className="flex flex-1 flex-col p-4 sm:p-5 min-w-0"
                      aria-label={personalRecommendationAria(baseRec)}
                    >
                      {offer.businessName && (
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                          {offer.businessName}
                        </span>
                      )}

                      <h4 className="mt-0.5 font-semibold text-base text-foreground leading-snug line-clamp-2">
                        {offer.title}
                      </h4>

                      <OfferRecommendationBlock
                        first={baseRec.first}
                        second={baseRec.second}
                      />

                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        {basePriceLine && (
                          <span className="text-base font-semibold text-foreground tabular-nums">
                            {basePriceLine}
                          </span>
                        )}
                        {offer.rating && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                            {offer.rating}
                            {offer.reviewCount != null && (
                              <span className="opacity-70">({offer.reviewCount})</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* CTA */}
                      <div className="mt-4 flex items-center gap-3 justify-end sm:justify-start flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewOfferId(offer.id);
                          }}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-gray-50"
                        >
                          Подробнее
                        </button>
                        <AddRemoveButton
                          variant="venue"
                          size="md"
                          selected={isSelected}
                          labels={{
                            default: "Добавить",
                            selected: "Добавить",
                            hover: "Убрать",
                          }}
                          onClick={() => {
                            const wasSelected = isSelected;
                            selectBase(offer.id);
                            if (!wasSelected) toast.success("Добавлено в праздник");
                          }}
                          className="min-w-[140px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded: только для выбранной карточки */}
                  {isSelected && (
                    <div className="border-t border-border/60 bg-muted/5">
                      <div className="p-4 sm:p-5 space-y-4">
                        {/* A. Что доступно в этом месте */}
                        {hasVenueIncludes && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Что доступно в этом месте
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {offer.venueIncludes!.map((inc) => (
                                <span
                                  key={inc}
                                  className="inline-flex rounded-lg bg-white border border-border/60 px-2.5 py-1 text-xs text-foreground/90"
                                >
                                  {VENUE_INCLUDES_LABELS[inc] || inc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* B. Quick-add внутри выбранной карточки */}
                        {offersForThisVenue.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Можно добавить сразу
                            </h4>
                            <div className="flex flex-col gap-2">
                              {offersForThisVenue.map((addon) => {
                                const isAddonSelected = selectedAddonIds.includes(addon.id);
                                const addonRec = generatePersonalRecommendation(addon, {
                                  partyForChild,
                                  theme,
                                });
                                const priceLine = formatConcreteOfferPrice(addon);
                                return (
                                  <div
                                    key={addon.id}
                                    className={cn(
                                      "flex flex-col gap-2.5 rounded-xl border bg-white p-3 transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                                      isAddonSelected
                                        ? "border-[#EF8759]/60 bg-orange-50/20"
                                        : "border-border/60 hover:border-border"
                                    )}
                                  >
                                    <div
                                      className="min-w-0 flex-1"
                                      aria-label={personalRecommendationAria(addonRec)}
                                    >
                                      <p className="font-medium text-sm text-foreground leading-snug">
                                        {addon.title}
                                      </p>
                                      <OfferRecommendationBlock
                                        first={addonRec.first}
                                        second={addonRec.second}
                                      />
                                      {priceLine && (
                                        <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                                          {priceLine}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                      <button
                                        type="button"
                                        onClick={() => setQuickViewOfferId(addon.id)}
                                        className={cn(
                                          "flex items-center justify-center font-semibold transition-all duration-150",
                                          "rounded-lg px-3 py-1.5 text-xs",
                                          "bg-white border border-border text-foreground hover:border-[#EF8759] hover:bg-orange-50",
                                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759] focus-visible:ring-offset-2",
                                          "active:scale-[0.98]",
                                        )}
                                      >
                                        Подробнее
                                      </button>
                                      <AddRemoveButton
                                        selected={isAddonSelected}
                                        onClick={() => {
                                          const wasSelected = isAddonSelected;
                                          toggleAddon(addon.id);
                                          if (!wasSelected) toast.success("Добавлено в праздник");
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info for HOME/OUTDOOR */}
      {(placeType === "HOME" || placeType === "OUTDOOR") && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
          <p className="text-sm text-foreground">
            {placeType === "HOME" 
              ? "Отлично! Мы подберём услуги, которые можно заказать на дом."
              : "Отлично! Мы подберём услуги для праздника на природе."}
          </p>
        </div>
      )}

      <OfferQuickView
        open={!!quickViewOfferId}
        onClose={() => setQuickViewOfferId(null)}
        offer={
          quickViewOfferId
            ? mockBirthdayOffers.find((o) => o.id === quickViewOfferId) ?? null
            : null
        }
        builder={builder}
      />

      {!canProceed && showVenueList && (
        <p className="text-xs text-muted-foreground text-center">
          Выберите площадку, чтобы продолжить
        </p>
      )}
    </div>
  );
}

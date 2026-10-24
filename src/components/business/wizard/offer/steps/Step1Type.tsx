"use client";

import { useState } from "react";
import {
  CalendarRange,
  GraduationCap,
  MapPin,
  PartyPopper,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OfferCategoryPicker } from "../components/OfferCategoryPicker";
import type { LucideIcon } from "lucide-react";
import type { OfferFormData, OfferProductType } from "../types";
import {
  OFFER_CREATION_CATEGORIES,
  getOfferCreationCategory,
  getOfferTypeSelection,
  type OfferCreationCategory,
  type OfferCreationCategoryKey,
} from "../offerTypeChoices";

interface Step1TypeProps {
  data: OfferFormData;
  onChange: (
    updates:
      | Partial<OfferFormData>
      | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
  /** Новый мастер: показывать выбор категорий после выбора формата. */
  showCategories?: boolean;
}

const icons: Record<OfferCreationCategoryKey, LucideIcon> = {
  place: MapPin,
  classes: GraduationCap,
  parties: PartyPopper,
  camps: CalendarRange,
};

export function Step1Type({ data, onChange, isEditable, showCategories = false }: Step1TypeProps) {
  // Remember an expanded category before its subtype has been selected.
  // Once a subtype is chosen, productType remains the source of truth (also on edit/restore).
  const [expandedCategory, setExpandedCategory] = useState<OfferCreationCategoryKey | null>(null);
  const selectedCategory = getOfferCreationCategory(data.productType);
  const activeCategory =
    OFFER_CREATION_CATEGORIES.find(
      (category) => category.key === (expandedCategory ?? selectedCategory?.key),
    ) ?? null;

  const handleTypeChange = (productType: OfferProductType) => {
    if (data.productType === productType) return;
    const selection = getOfferTypeSelection(productType);
    onChange((prev) => ({
      ...selection,
      // Лагерь всегда принимает заявку внутри mamaGo; внешние CTA не предлагаем.
      schedule: productType === "CAMP"
        ? { ...prev.schedule, bookingMethod: "REQUEST_ONLY", legacyBookingMode: null, externalUrl: "" }
        : prev.schedule,
      // Категории зависят от формата: при смене формата выбор сбрасывается.
      categoryIds: [],
      serviceType: null,
      locationType: null,
      classFormat:
        productType === "ONE_TIME_ACTIVITY" || productType === "REGULAR_ACTIVITY"
          ? prev.classFormat
          : null,
    }));
  };

  const handleCategoryChange = (category: OfferCreationCategory) => {
    setExpandedCategory(category.key);
    if (category.options.length > 1) {
      // On mobile the four main cards can take more than one screen. Bring
      // the newly revealed choices into view instead of leaving them below the fold.
      window.requestAnimationFrame(() => {
        document.getElementById("offer-creation-format")?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
    }
    if (category.options.length === 1) {
      handleTypeChange(category.options[0].value);
    } else if (selectedCategory?.key !== category.key && data.productType) {
      // Prevent continuing with the previously chosen productType while
      // the user is choosing a different subtype.
      onChange({
        productType: null,
        offerWizardType: null,
        offerKind: null,
        durationType: null,
        intent: null,
        requestedPlacements: [],
        categoryIds: [],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">
          Что вы хотите предложить семьям?
        </h2>
        <p className="text-sm text-muted-foreground">
          Выберите подходящий вариант. Детали уточним дальше.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OFFER_CREATION_CATEGORIES.map((category) => {
          const Icon = icons[category.key];
          const isActive = activeCategory?.key === category.key;
          const isChosen = selectedCategory?.key === category.key;
          return (
            <button
              type="button"
              key={category.key}
              onClick={() => handleCategoryChange(category)}
              disabled={!isEditable}
              aria-pressed={isActive}
              aria-controls={isActive && category.options.length > 1 ? "offer-creation-format" : undefined}
              className={cn(
                "w-full rounded-2xl border bg-card p-4 text-left transition-colors sm:p-5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "hover:border-[#EF8759]/70 disabled:cursor-not-allowed disabled:opacity-60",
                isActive ? "border-[#EF8759] bg-[#EF8759]/5" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EF8759]/10 text-[#EF8759]">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                    {category.label}
                    {isChosen && <Check aria-hidden="true" className="size-4 shrink-0 text-[#EF8759]" />}
                  </span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">
                    {category.description}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activeCategory && activeCategory.options.length > 1 && (
        <section
          id="offer-creation-format"
          className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5"
          aria-label={activeCategory.question}
        >
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {activeCategory.question}
            </h3>
            <p className="text-sm text-muted-foreground">
              Выберите один вариант, чтобы продолжить.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCategory.options.map((option) => {
              const isSelected = data.productType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTypeChange(option.value)}
                  disabled={!isEditable}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-28 flex-col gap-1 rounded-xl border bg-card p-4 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "hover:border-[#EF8759]/70 disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected && "border-[#EF8759] bg-[#EF8759]/5",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2 font-medium text-foreground">
                    {option.label}
                    {isSelected && <Check aria-hidden="true" className="size-4 shrink-0 text-[#EF8759]" />}
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showCategories && data.productType && (
        <OfferCategoryPicker
          productType={data.productType}
          value={data.categoryIds}
          onChange={(categoryIds) => onChange({ categoryIds })}
          isEditable={isEditable}
        />
      )}
    </div>
  );
}

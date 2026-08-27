"use client";

import { useEffect } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "./RecommendationCard";
import type { PlanItemWithActivity } from "../types/event";
import type { PlanSlotType } from "../hooks/useMyPlan";
import { postProductTelemetryEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

interface PlanSuggestionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: PlanSlotType;
  date: string;
  /** Текущая рекомендация */
  suggestionItem: PlanItemWithActivity | null;
  /** Позиция текущего варианта (1-based) */
  variantPosition: number;
  /** Всего вариантов */
  variantTotal: number;
  /** Добавить в план */
  onAddToPlan: (item: PlanItemWithActivity) => void;
  /** Следующий вариант */
  onShowNext: () => void;
  /** Предыдущий вариант */
  onShowPrevious: () => void;
  layout?: "default" | "desktop";
}

const SLOT_LABELS: Record<PlanSlotType, string> = {
  morning: "Утро",
  afternoon: "День",
  evening: "Вечер",
};

export function PlanSuggestionsSheet({
  open,
  onOpenChange,
  slot,
  date,
  suggestionItem,
  variantPosition,
  variantTotal,
  onAddToPlan,
  onShowNext,
  onShowPrevious,
  layout = "default",
}: PlanSuggestionsSheetProps) {
  const isDesktop = layout === "desktop";
  const slotLabel = SLOT_LABELS[slot];

  useEffect(() => {
    if (!open || !suggestionItem?.activityId) return;

    void postProductTelemetryEvent({
      eventType: "CARD_VIEW",
      entityType: "EVENT",
      entityId: suggestionItem.activityId,
      vertical: "CITY",
      meta: {
        source: "recommendation",
        section: "afisha",
        recommendationSurface: "plan_suggestions",
        slot,
        selectedDate: date,
        position: variantPosition,
        variantTotal,
      },
    });
  }, [
    open,
    suggestionItem?.activityId,
    slot,
    date,
    variantPosition,
    variantTotal,
  ]);

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-[#EF8759]" />
              <h2 className="text-lg font-semibold text-neutral-900">
                Подобрать для {slotLabel.toLowerCase()}
              </h2>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {variantTotal > 0
                ? `Вариант ${variantPosition} из ${variantTotal}`
                : "Нет доступных вариантов"}
            </p>
          </div>
          <ModalCloseButton
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0"
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {suggestionItem ? (
          <div className="space-y-4">
            <RecommendationCard
              item={suggestionItem}
              isRecommendation={false}
              onAddToPlan={() => {
                onAddToPlan(suggestionItem);
                onOpenChange(false);
              }}
            />

            {variantTotal > 1 ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onShowPrevious}
                  disabled={variantPosition === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Предыдущий вариант"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-neutral-500">
                  {variantPosition} / {variantTotal}
                </span>
                <button
                  type="button"
                  onClick={onShowNext}
                  disabled={variantPosition === variantTotal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Следующий вариант"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-neutral-300 mb-4" />
            <p className="text-sm text-neutral-500">
              Нет доступных рекомендаций для этого времени
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {suggestionItem ? (
        <div className="flex-shrink-0 border-t border-neutral-200 bg-white px-5 py-4">
          <Button
            onClick={() => {
              onAddToPlan(suggestionItem);
              onOpenChange(false);
            }}
            className="h-12 w-full bg-[#EF8759] text-base font-semibold hover:bg-primary-hover"
          >
            Добавить в план
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full",
          )}
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85vh] max-h-[85vh] flex-col gap-0 p-0"
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}

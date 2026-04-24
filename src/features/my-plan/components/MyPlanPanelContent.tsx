"use client";

import { useEffect, useState } from "react";
import { useMyPlan } from "../hooks/useMyPlan";
import { PlanMainContent } from "./PlanMainContent";

interface MyPlanPanelContentProps {
  open: boolean;
  layout?: "default" | "desktop";
  onRequestClose: () => void;
}

export function MyPlanPanelContent({
  open,
  layout = "default",
  onRequestClose,
}: MyPlanPanelContentProps) {
  const {
    isLoading,
    accessPhase,
    planSlots,
    children,
    selectedChildIds,
    setSelectedChildIds,
    selectedAgeRanges,
    setSelectedAgeRanges,
    autoAgeValues,
    createChild,
    submittingChild,
    selectedPlanDate,
    setSelectedPlanDate,
    weekDates,
    planItemsByDate,
    todayIso,
    cycleSlotAlternative,
    cycleSlotAlternativePrev,
    markSlotSaved,
    clearSlotSaved,
    openSlotSuggestion,
    ideas,
    ideasLoading,
    addIdeaToPlan,
    removeIdea,
    planSuggestions,
    suggestionsLoading,
    addActivityToPlanFromSuggestion,
    refetchPlanForDate,
  } = useMyPlan();

  const [addErr, setAddErr] = useState<string | null>(() => null);
  const [isDateLoading, setIsDateLoading] = useState(false);

  /** Подтягиваем план с сервера при открытии и при смене даты — единый источник с БД + live после add. */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsDateLoading(true);
      void refetchPlanForDate(selectedPlanDate).finally(() => {
        if (!cancelled) setIsDateLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedPlanDate, refetchPlanForDate]);

  if (isLoading || accessPhase === "loading") {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[320px]">
        <div className="text-center px-6">
          <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загружаем ваш план...</p>
        </div>
      </div>
    );
  }

  return (
    <PlanMainContent
      layout={layout}
      selectedDate={selectedPlanDate}
      onChangeDate={setSelectedPlanDate}
      planItemsByDate={planItemsByDate}
      todayIso={todayIso}
      onAddItemToPlan={markSlotSaved}
      childrenList={children.map((c) => ({ id: c.id, name: c.name, birthDate: c.birthDate }))}
      selectedChildIds={selectedChildIds}
      onChangeSelectedChildIds={setSelectedChildIds}
      selectedAgeRanges={selectedAgeRanges}
      onChangeSelectedAgeRanges={setSelectedAgeRanges}
      ideas={ideas}
      ideasLoading={ideasLoading}
      onAddIdeaToPlan={addIdeaToPlan}
      onRemoveIdea={removeIdea}
      planSuggestions={planSuggestions}
      suggestionsLoading={suggestionsLoading}
      onAddSuggestionToPlan={addActivityToPlanFromSuggestion}
      onRemoveItemFromPlan={clearSlotSaved}
      dateLoading={isDateLoading}
      onRequestClose={onRequestClose}
    />
  );
}

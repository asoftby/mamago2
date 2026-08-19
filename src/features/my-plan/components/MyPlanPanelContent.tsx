"use client";

import { useEffect, useState } from "react";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useMyPlan } from "../hooks/useMyPlan";
import { PlanMainContent } from "./PlanMainContent";
import { GuestMyPlanPanel } from "./GuestMyPlanPanel";

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
    children,
    selectedChildIds,
    setSelectedChildIds,
    selectedAgeRanges,
    setSelectedAgeRanges,
    selectedPlanDate,
    setSelectedPlanDate,
    planItemsByDate,
    scenarioStatusByDate,
    planSummary,
    planCountsByDate,
    serverConfirmedPlanDates,
    todayIso,
    markSlotSaved,
    clearSlotSaved,
    ideas,
    ideasLoading,
    addIdeaToPlan,
    removeIdea,
    planSuggestions,
    suggestionsLoading,
    addActivityToPlanFromSuggestion,
    refetchPlanForDate,
  } = useMyPlan();

  const { isAuthenticated, isLoading: authMeLoading } = useAuthMe();

  const [isDateLoading, setIsDateLoading] = useState(false);

  /** Подтягиваем план с сервера при открытии и при смене даты — только для авторизованных */
  useEffect(() => {
    if (!open || !isAuthenticated) return;
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
  }, [open, isAuthenticated, selectedPlanDate, refetchPlanForDate]);

  if (authMeLoading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <div className="px-6 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          <p className="text-gray-600">Загружаем ваш план...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <GuestMyPlanPanel
        layout={layout}
        onRequestClose={onRequestClose}
        setSelectedPlanDate={setSelectedPlanDate}
        todayIso={todayIso}
      />
    );
  }

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
      scenarioStatusByDate={scenarioStatusByDate}
      nearestPlanDate={planSummary?.nearestDate ?? null}
      nearestPlanCount={planSummary?.nearestCount ?? 0}
      nearestPlanItems={planSummary?.nearestItems ?? []}
      plannedCountByDate={planCountsByDate}
      serverPlanSnapshotConfirmed={serverConfirmedPlanDates.includes(selectedPlanDate)}
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

"use client";

import { useEffect, useState } from "react";
import { useMyPlan } from "../hooks/useMyPlan";
import { AddChildStep } from "./AddChildStep";
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
  } = useMyPlan();

  const [addErr, setAddErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) setAddErr(null);
  }, [open]);

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

  if (accessPhase === "no_children") {
    return (
      <AddChildStep
        submitting={submittingChild}
        serverError={addErr}
        onSubmit={async (data) => {
          setAddErr(null);
          const r = await createChild(data);
          if (!r.ok) setAddErr(r.error ?? "Не удалось сохранить");
        }}
      />
    );
  }

  return (
    <PlanMainContent
      layout={layout}
      planSlots={planSlots}
      selectedDate={selectedPlanDate}
      onChangeDate={setSelectedPlanDate}
      weekDates={weekDates}
      planItemsByDate={planItemsByDate}
      todayIso={todayIso}
      childrenList={children.map((c) => ({ id: c.id, name: c.name, birthDate: c.birthDate }))}
      selectedChildIds={selectedChildIds}
      onChangeSelectedChildIds={setSelectedChildIds}
      selectedAgeRanges={selectedAgeRanges}
      onChangeSelectedAgeRanges={setSelectedAgeRanges}
      autoAgeValues={autoAgeValues}
      onCycleSlotAlternative={cycleSlotAlternative}
      onCycleSlotAlternativePrev={cycleSlotAlternativePrev}
      onMarkSlotSaved={markSlotSaved}
      onClearSlotSaved={clearSlotSaved}
      onOpenSlotSuggestion={openSlotSuggestion}
      ideas={ideas}
      ideasLoading={ideasLoading}
      onAddIdeaToPlan={addIdeaToPlan}
      onRemoveIdea={removeIdea}
      onRequestClose={onRequestClose}
    />
  );
}

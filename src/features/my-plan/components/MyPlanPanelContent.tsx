"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { migrateGuestMyPlanAfterAuth } from "@/lib/my-plan/migrateGuestMyPlanAfterAuth";
import { useMyPlan } from "../hooks/useMyPlan";
import type { PlanItemWithActivity } from "../types/event";
import { PlanMainContent } from "./PlanMainContent";
import { GuestMyPlanPanel } from "./GuestMyPlanPanel";

interface MyPlanPanelContentProps {
  open: boolean;
  layout?: "default" | "desktop";
  onRequestClose: () => void;
}

function isCurrentOrFuturePlanItem(
  item: PlanItemWithActivity,
  todayIso: string,
  nowMs: number,
): boolean {
  if (item.date < todayIso) return false;
  if (item.date > todayIso || item.startsAt == null) return true;

  const startsAtMs =
    item.startsAt instanceof Date
      ? item.startsAt.getTime()
      : new Date(item.startsAt).getTime();

  // Invalid/unknown time should not make a plan item disappear.
  return Number.isNaN(startsAtMs) || startsAtMs >= nowMs;
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
    refetchPlanSummary,
  } = useMyPlan();

  const { isAuthenticated, isLoading: authMeLoading } = useAuthMe();

  const [isDateLoading, setIsDateLoading] = useState(false);
  const effectiveSelectedPlanDate =
    selectedPlanDate < todayIso ? todayIso : selectedPlanDate;

  const handleChangeDate = useCallback(
    (date: string) => {
      setSelectedPlanDate(date < todayIso ? todayIso : date);
    },
    [setSelectedPlanDate, todayIso],
  );

  const visiblePlanItemsByDate = useMemo(() => {
    const nowMs = Date.now();
    const next: Record<string, PlanItemWithActivity[]> = {};

    for (const [date, items] of Object.entries(planItemsByDate)) {
      if (date < todayIso) continue;
      const visibleItems = items.filter((item) =>
        isCurrentOrFuturePlanItem(item, todayIso, nowMs),
      );
      if (visibleItems.length > 0 || date === effectiveSelectedPlanDate) {
        next[date] = visibleItems;
      }
    }

    return next;
  }, [effectiveSelectedPlanDate, open, planItemsByDate, todayIso]);

  const visiblePlanCountsByDate = useMemo(() => {
    const next = Object.fromEntries(
      Object.entries(planCountsByDate).filter(([date]) => date >= todayIso),
    ) as Record<string, number>;

    for (const date of serverConfirmedPlanDates) {
      if (date < todayIso) continue;
      next[date] = visiblePlanItemsByDate[date]?.length ?? 0;
    }

    return next;
  }, [planCountsByDate, serverConfirmedPlanDates, todayIso, visiblePlanItemsByDate]);

  /** Старую сохранённую дату виджета никогда не восстанавливаем как активную. */
  useEffect(() => {
    if (!open || !isAuthenticated || selectedPlanDate >= todayIso) return;
    setSelectedPlanDate(todayIso);
  }, [open, isAuthenticated, selectedPlanDate, setSelectedPlanDate, todayIso]);

  /**
   * Recovery bridge for guest "Подбери за меня" -> auth.
   * The main post-auth pipeline performs the same idempotent migration earlier;
   * this retry covers interrupted navigation/auth-cookie races. The local draft
   * is cleared only after every explicitly committed card is saved by the API.
   */
  useEffect(() => {
    if (!open || !isAuthenticated || authMeLoading) return;
    let cancelled = false;

    void migrateGuestMyPlanAfterAuth()
      .then((result) => {
        if (cancelled || result.migratedCount === 0) return;
        if (result.selectedDate) {
          const migratedDate =
            result.selectedDate < todayIso ? todayIso : result.selectedDate;
          setSelectedPlanDate(migratedDate);
          void refetchPlanForDate(migratedDate);
        }
        void refetchPlanSummary();
      })
      .catch((error) => {
        console.error("[my-plan] guest plan recovery migration failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isAuthenticated,
    authMeLoading,
    setSelectedPlanDate,
    refetchPlanForDate,
    refetchPlanSummary,
    todayIso,
  ]);

  /** Подтягиваем план с сервера при открытии и при смене даты — только для авторизованных */
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsDateLoading(true);
      void refetchPlanForDate(effectiveSelectedPlanDate).finally(() => {
        if (!cancelled) setIsDateLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, isAuthenticated, effectiveSelectedPlanDate, refetchPlanForDate]);

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
        setSelectedPlanDate={handleChangeDate}
        todayIso={todayIso}
      />
    );
  }

  // Не показываем ни одного кадра со старой persisted-датой, пока исправляем state.
  if (selectedPlanDate < todayIso) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <div className="px-6 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          <p className="text-gray-600">Загружаем ваш план...</p>
        </div>
      </div>
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
      selectedDate={effectiveSelectedPlanDate}
      onChangeDate={handleChangeDate}
      planItemsByDate={visiblePlanItemsByDate}
      scenarioStatusByDate={scenarioStatusByDate}
      nearestPlanDate={planSummary?.nearestDate ?? null}
      nearestPlanCount={planSummary?.nearestCount ?? 0}
      nearestPlanItems={planSummary?.nearestItems ?? []}
      plannedCountByDate={visiblePlanCountsByDate}
      serverPlanSnapshotConfirmed={serverConfirmedPlanDates.includes(effectiveSelectedPlanDate)}
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

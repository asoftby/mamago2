"use client";

import { useCallback, useEffect, useState } from "react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { MY_PLAN_QUICK_ADD_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import { usePlanOverlay } from "@/lib/my-plan/usePlanOverlay";
import { useMyPlan } from "../hooks/useMyPlan";
import { QuickAddPlanNoteSheet } from "./QuickAddPlanNoteSheet";

/**
 * Единственная шторка на экране: «Добавить в план» не открывается поверх шторки плана,
 * а заменяет её — шторка плана закрывается, а после сохранения/отмены возвращается.
 */
export function PlanQuickAddHost() {
  const { close: closePlan, open: openPlan } = usePlanOverlay();
  const { children, selectedPlanDate } = useMyPlan();
  const city = useOptionalCity()?.citySlug ?? DEFAULT_CITY_SLUG;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(selectedPlanDate);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const requested = (event as CustomEvent<{ date?: string }>).detail?.date;
      setDate(requested || selectedPlanDate);
      closePlan();
      setOpen(true);
    };
    window.addEventListener(MY_PLAN_QUICK_ADD_EVENT, onRequest);
    return () => window.removeEventListener(MY_PLAN_QUICK_ADD_EVENT, onRequest);
  }, [closePlan, selectedPlanDate]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) openPlan();
    },
    [openPlan],
  );

  return (
    <QuickAddPlanNoteSheet
      open={open}
      onOpenChange={handleOpenChange}
      selectedDate={date}
      childrenList={children.map((child) => ({ id: child.id, name: child.name }))}
      city={city}
    />
  );
}

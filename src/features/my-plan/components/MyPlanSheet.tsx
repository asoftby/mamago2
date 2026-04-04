"use client";

import { useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMyPlan } from "../hooks/useMyPlan";
import { MyPlanPanelContent } from "./MyPlanPanelContent";

interface MyPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyPlanSheet({ open, onOpenChange }: MyPlanSheetProps) {
  const { isLoading, accessPhase } = useMyPlan();

  const handleTouchStartY = useRef<number | null>(null);
  const handleTouchCurrentY = useRef<number | null>(null);

  const onHandleTouchStart: React.TouchEventHandler<HTMLButtonElement> = (event) => {
    handleTouchStartY.current = event.touches[0]?.clientY ?? null;
    handleTouchCurrentY.current = handleTouchStartY.current;
  };
  const onHandleTouchMove: React.TouchEventHandler<HTMLButtonElement> = (event) => {
    handleTouchCurrentY.current = event.touches[0]?.clientY ?? null;
  };
  const onHandleTouchEnd: React.TouchEventHandler<HTMLButtonElement> = () => {
    if (handleTouchStartY.current == null || handleTouchCurrentY.current == null) return;
    const delta = handleTouchCurrentY.current - handleTouchStartY.current;
    if (delta > 56) onOpenChange(false);
    handleTouchStartY.current = null;
    handleTouchCurrentY.current = null;
  };

  const a11yTitle =
    isLoading || accessPhase === "loading"
      ? "Загрузка плана"
      : accessPhase === "no_children"
        ? "Добавьте ребенка"
        : "Мой план";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[88vh] rounded-t-3xl border-t border-neutral-200 bg-white p-0 overflow-hidden flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{a11yTitle}</SheetTitle>
        </SheetHeader>

        <button
          type="button"
          aria-label="Потяните вниз, чтобы закрыть"
          className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full p-2"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onClick={() => onOpenChange(false)}
        >
          <span className="block h-1 w-12 rounded-full bg-neutral-300" />
        </button>

        <MyPlanPanelContent
          open={open}
          onRequestClose={() => onOpenChange(false)}
        />

      </SheetContent>
    </Sheet>
  );
}

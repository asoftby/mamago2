"use client";

import { useRef } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { MyPlanPanelContent } from "./MyPlanPanelContent";
import { cn } from "@/lib/utils";

export interface MyPlanOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Единая оболочка «Мой план».
 * Desktop → Dialog (max-w ~572px — на ~10% шире 520px, закрытие по backdrop / Esc / X)
 * Mobile  → Bottom Sheet (swipe down, drag handle)
 * Контент: MyPlanPanelContent → PlanMainContent (авторизованные) или GuestMyPlanPanel (гость).
 */
export function MyPlanOverlay({ open, onOpenChange }: MyPlanOverlayProps) {
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  const onTouchStart: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
    touchCurrentY.current = touchStartY.current;
  };
  const onTouchMove: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    touchCurrentY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd: React.TouchEventHandler<HTMLButtonElement> = () => {
    if (touchStartY.current == null || touchCurrentY.current == null) return;
    if (touchCurrentY.current - touchStartY.current > 56) onOpenChange(false);
    touchStartY.current = null;
    touchCurrentY.current = null;
  };

  const dragHandle = (
    <button
      type="button"
      aria-label="Потяните вниз, чтобы закрыть"
      className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full p-2 md:hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => onOpenChange(false)}
    >
      <span className="block h-1 w-12 rounded-full bg-neutral-300" />
    </button>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Мой план"
      variant="chromeless"
      dismissible={true}
      showCloseButton={false}
      mobileTopSlot={dragHandle}
      heightMode="tall"
      dialogContentClassName="!max-w-[572px]"
      bodyClassName="min-h-0 overflow-hidden"
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          "animate-in fade-in-0 duration-150",
        )}
      >
        <MyPlanPanelContent
          open={open}
          layout="default"
          onRequestClose={() => onOpenChange(false)}
        />
      </div>
    </ResponsiveOverlay>
  );
}

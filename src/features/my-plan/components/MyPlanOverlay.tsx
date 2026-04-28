"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { MyPlanPanelContent } from "./MyPlanPanelContent";
import { MyPlanUnauthFlow, type MyPlanUnauthSurface } from "./unauth/MyPlanUnauthFlow";
import { appendMyPlanOpenToHref } from "@/lib/my-plan/myPlanOpenIntent";
import { cn } from "@/lib/utils";

export type { MyPlanUnauthSurface };

export interface MyPlanOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  authNextHref?: string;
  onGuestAuthSuccess?: () => void;
  onUnauthBeforeClose?: (ctx: { surface: MyPlanUnauthSurface }) => void;
  onPostAuthCompletionPhase?: (active: boolean) => void;
}

/**
 * Единая оболочка «Мой план».
 * Desktop → Dialog (max-w-[520px], закрытие по backdrop / Esc / X)
 * Mobile  → Bottom Sheet (swipe down, drag handle)
 * Контент одинаковый: MyPlanPanelContent → PlanMainContent
 */
export function MyPlanOverlay({
  open,
  onOpenChange,
  isAuthenticated,
  authNextHref,
  onGuestAuthSuccess,
  onUnauthBeforeClose,
  onPostAuthCompletionPhase,
}: MyPlanOverlayProps) {
  const pathname = usePathname();

  // Drag-to-close на mobile
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

  const resolvedNextHref = authNextHref ?? appendMyPlanOpenToHref(pathname || "/");

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Мой план"
      variant="chromeless"
      // Desktop: закрытие по backdrop и Esc
      dismissible={true}
      showCloseButton={false}
      mobileTopSlot={dragHandle}
      heightMode="tall"
      // Desktop: компактный modal
      dialogContentClassName="!max-w-[520px]"
      bodyClassName="min-h-0 overflow-hidden"
    >
      {!isAuthenticated ? (
        <MyPlanUnauthFlow
          open={open}
          onRequestClose={() => onOpenChange(false)}
          nextHref={resolvedNextHref}
          onAuthSuccess={onGuestAuthSuccess}
          onBeforeClose={onUnauthBeforeClose}
          onPostAuthCompletionPhase={onPostAuthCompletionPhase}
        />
      ) : (
        <div
          key="plan"
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
        >
          {/* Единый контент для desktop и mobile */}
          <MyPlanPanelContent
            open={open}
            layout="default"
            onRequestClose={() => onOpenChange(false)}
          />
        </div>
      )}
    </ResponsiveOverlay>
  );
}

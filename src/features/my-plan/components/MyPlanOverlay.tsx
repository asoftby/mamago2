"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { useMyPlan } from "../hooks/useMyPlan";
import { MyPlanPanelContent } from "./MyPlanPanelContent";
import { MyPlanUnauthFlow, type MyPlanUnauthSurface } from "./unauth/MyPlanUnauthFlow";
import { appendMyPlanOpenToHref } from "@/lib/my-plan/myPlanOpenIntent";
import { cn } from "@/lib/utils";

export type { MyPlanUnauthSurface };

export interface MyPlanOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** После входа показываем тот же контейнер с планом без закрытия. */
  isAuthenticated: boolean;
  authNextHref?: string;
  onGuestAuthSuccess?: () => void;
  onUnauthBeforeClose?: (ctx: { surface: MyPlanUnauthSurface }) => void;
  /** Пока идёт ProfileCompletionFlow внутри unauth — держим unauth-ветку даже при валидной сессии */
  onPostAuthCompletionPhase?: (active: boolean) => void;
}

/**
 * Единая оболочка «Мой план»: ResponsiveOverlay + цельный unauth-flow или панель плана.
 * Desktop → dialog, mobile → sheet; контент одного product flow.
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
  const { isLoading, accessPhase } = useMyPlan();
  const isDesktopLayout = useMediaQuery("(min-width: 768px)");

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

  const a11yTitle = !isAuthenticated
    ? "Мой план"
    : isLoading || accessPhase === "loading"
      ? "Загрузка плана"
      : accessPhase === "no_children"
        ? "Добавьте ребенка"
        : "Мой план";

  const dragHandle = (
    <button
      type="button"
      aria-label="Потяните вниз, чтобы закрыть"
      className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full p-2 md:hidden"
      onTouchStart={onHandleTouchStart}
      onTouchMove={onHandleTouchMove}
      onTouchEnd={onHandleTouchEnd}
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
      a11yTitle={a11yTitle}
      variant="chromeless"
      dismissible={false}
      showCloseButton={false}
      mobileTopSlot={dragHandle}
      heightMode="tall"
      bodyClassName="min-h-0"
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
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
        >
          <MyPlanPanelContent
            open={open}
            layout={isDesktopLayout ? "desktop" : "default"}
            onRequestClose={() => onOpenChange(false)}
          />
        </div>
      )}
    </ResponsiveOverlay>
  );
}

"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { MyPlanPanelContent } from "./MyPlanPanelContent";
import { MyPlanWidgetV2 } from "./MyPlanWidgetV2";
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

  const a11yTitle = "Мой план";

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
      dialogContentClassName="!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[min(92vw,760px)] !max-w-[760px] !bg-transparent !border-0 !shadow-none !p-0"
      bodyClassName="min-h-0 !overflow-visible"
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
          {isDesktopLayout ? (
            <div className="relative flex h-full min-h-0 flex-1 items-center justify-center bg-transparent p-0">
              <ModalCloseButton
                type="button"
                onClick={() => onOpenChange(false)}
                className="absolute right-5 top-5 z-20"
              />
              <MyPlanWidgetV2 onOpen={() => {}} mode="overlay" />
            </div>
          ) : (
            <MyPlanPanelContent
              open={open}
              layout="default"
              onRequestClose={() => onOpenChange(false)}
            />
          )}
        </div>
      )}
    </ResponsiveOverlay>
  );
}

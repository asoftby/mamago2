"use client";

import { MyPlanCapsule } from "./MyPlanCapsule";

/**
 * Mobile My Plan pill. `hidden` is owned by MobilePlanBottomStack so the beta tip
 * can tuck with the same scroll signal.
 */
export function MyPlanMobileWidget({ hidden = false }: { hidden?: boolean }) {
  return (
    <nav
      aria-label="Мой план"
      aria-hidden={hidden}
      inert={hidden}
      className="pointer-events-none fixed inset-x-4 z-40 transition-transform duration-[220ms] ease-out motion-reduce:transition-none lg:hidden"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        transform: hidden
          ? "translate3d(0, calc(100% + 12px + env(safe-area-inset-bottom, 0px)), 0)"
          : "translate3d(0, 0, 0)",
      }}
    >
      <MyPlanCapsule className="w-full shadow-[0_6px_20px_rgba(20,18,16,0.16)]" openInOverlay />
    </nav>
  );
}

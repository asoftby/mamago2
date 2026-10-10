"use client";

import { MyPlanCapsule } from "./MyPlanCapsule";

/**
 * Мобильный (< lg) «Мой план»: единственный липкий элемент внизу (см. `resolveMobileBottomSlot`).
 * Пилюля на всю ширину с отступами 16px, всегда развёрнута.
 */
export function MyPlanMobileWidget() {
  return (
    <nav
      aria-label="Мой план"
      className="pointer-events-none fixed inset-x-4 z-40 lg:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <MyPlanCapsule className="w-full shadow-[0_6px_20px_rgba(20,18,16,0.16)]" openInOverlay />
    </nav>
  );
}

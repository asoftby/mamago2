"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { MyPlanCapsule } from "./MyPlanCapsule";

/**
 * Мобильный (< lg) «Мой план»: единственный липкий элемент внизу (см. `resolveMobileBottomSlot`).
 * Пилюля на всю ширину с отступами 16px; при скролле вниз сжимается в кружок с датой (56px),
 * при скролле вверх разворачивается.
 */
export function MyPlanMobileWidget() {
  const pathname = usePathname();
  const compact = useScrollDirection({ resetKey: pathname });

  return (
    <nav
      aria-label="Мой план"
      className="pointer-events-none fixed inset-x-4 z-40 flex justify-end lg:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className={cn(
          "pointer-events-auto min-w-0 transition-[width] duration-[220ms] ease-out motion-reduce:transition-none",
          compact ? "w-14" : "w-full",
        )}
      >
        <MyPlanCapsule compact={compact} className="w-full shadow-[0_6px_20px_rgba(20,18,16,0.16)]" />
      </div>
    </nav>
  );
}

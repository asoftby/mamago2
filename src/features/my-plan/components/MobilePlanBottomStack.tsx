"use client";

import { usePathname } from "next/navigation";
import { BetaTipMobile } from "@/components/shared/BetaTip";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { MyPlanMobileWidget } from "./MyPlanMobileWidget";

/**
 * Shared scroll chrome for the mobile plan pill + beta tip: one scroll signal so
 * both move together. Plan tucks fully off-screen; beta slides down but stays visible.
 */
export function MobilePlanBottomStack({ keepVisible = false }: { keepVisible?: boolean }) {
  const pathname = usePathname();
  const scrollingDown = useScrollDirection({ resetKey: pathname });
  const tucked = scrollingDown && !keepVisible;

  return (
    <>
      <BetaTipMobile tucked={tucked} />
      <MyPlanMobileWidget hidden={tucked} />
    </>
  );
}

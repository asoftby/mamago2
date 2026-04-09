import { cn } from "@/lib/utils";

/**
 * Единая высота каркаса всех unauth-шагов «Мой план» (sheet и desktop dialog),
 * чтобы окно не прыгало по высоте при смене экранов.
 */
export const MY_PLAN_UNAUTH_FRAME_MIN_H = "min-h-[min(88dvh,720px)]";

export function myPlanUnauthFlowRootClassName(className?: string) {
  return cn(
    "relative flex w-full min-h-0 flex-1 flex-col overflow-hidden",
    "h-full",
    MY_PLAN_UNAUTH_FRAME_MIN_H,
    className,
  );
}

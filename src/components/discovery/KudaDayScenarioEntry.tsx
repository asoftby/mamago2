"use client";

import { CalendarCheck, ArrowRight } from "lucide-react";
import { useDayScenarioEnabled } from "@/features/my-plan/hooks/useDayScenarioEnabled";
import { requestOpenMyPlanScreen } from "@/lib/my-plan/myPlanOpenIntent";

/**
 * «Куда пойти» → «Собрать день». Draws nothing until the day-scenario flag answers "on", so with
 * the flag off the page is exactly as before. Opens My Plan on the day scenario.
 */
export function KudaDayScenarioEntry() {
  const enabled = useDayScenarioEnabled();
  if (!enabled) return null;
  return (
    <section aria-label="Собрать день">
      <button
        type="button"
        onClick={() => requestOpenMyPlanScreen("dayScenario")}
        className="group flex min-h-[76px] w-full items-center gap-3.5 rounded-[22px] border border-border bg-surface-subtle py-3 pl-3.5 pr-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-xl"
      >
        <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <CalendarCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-[1.3] text-foreground">Собрать день</span>
          <span className="mt-[3px] block text-[13px] text-muted-foreground">Подберём места и события и разложим по времени</span>
        </span>
        <ArrowRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform group-hover:translate-x-[3px]" strokeWidth={1.8} aria-hidden />
      </button>
    </section>
  );
}

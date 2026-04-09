"use client";

import { cn } from "@/lib/utils";

const STEPS: { period: string; time: string; description: string }[] = [
  { period: "Утро", time: "09:00", description: "Спокойная активность" },
  { period: "День", time: "14:00", description: "Событие или прогулка" },
  { period: "Вечер", time: "19:00", description: "Семейный отдых" },
];

/**
 * Визуальный превью «плана дня» для unauth «Мой план» — не данные, а обещание результата.
 */
export function MyPlanDayTimelinePreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/70 bg-gradient-to-br from-amber-50/50 via-white to-neutral-50/90 p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <ul className="space-y-0">
        {STEPS.map((step, index) => (
          <li key={step.period} className="flex gap-3 sm:gap-4">
            <div className="flex w-4 shrink-0 flex-col items-center sm:w-5">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#EF8759] shadow-sm ring-2 ring-white ring-offset-1 ring-offset-amber-50/30 sm:h-2.5 sm:w-2.5"
                aria-hidden
              />
              {index < STEPS.length - 1 ? (
                <div
                  className="mt-1 w-px flex-1 min-h-[2.25rem] bg-gradient-to-b from-neutral-200 to-neutral-200/60 sm:min-h-[2.5rem]"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className={cn("min-w-0 flex-1", index < STEPS.length - 1 ? "pb-4" : "pb-0")}>
              <p className="text-sm font-semibold leading-tight text-neutral-900">{step.period}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 sm:text-[13px]">
                <span className="font-medium tabular-nums tracking-tight text-neutral-400">
                  {step.time}
                </span>{" "}
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

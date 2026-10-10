"use client";

import { ChevronLeft } from "lucide-react";

/** Шапка вложенного экрана модалки: «‹ План». */
export function PlanScreenHead({ back, onBack }: { back: string; onBack: () => void }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center px-4 pt-2 md:px-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex h-11 items-center gap-0.5 rounded-xl pl-1 pr-3 text-base font-bold text-[var(--mp-tx)] transition-colors hover:bg-[var(--mp-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)]"
      >
        <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
        {back}
      </button>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "./planChipStyles";

/**
 * Шапка вложенного экрана «Мой план» («Новое дело», «Где мы уже были»): заголовок модалки в том же
 * стиле, что «Мой план» (serif, акцент курсивом primary), со стрелкой влево — возврат в план.
 * Акцент передаётся как `<em>` внутри `title`.
 */
export function PlanScreenTitleHead({
  title,
  onBack,
  backLabel = "Назад в план",
}: {
  title: ReactNode;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-14 shrink-0 items-center px-4 pt-2 md:px-8">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className={cn(
          "mp-font-display -ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl pl-1 pr-3 text-[28px] font-normal leading-[1.1] tracking-[-.02em] text-[var(--mp-tx)]",
          "transition-colors hover:bg-[var(--mp-soft)] [&_em]:font-medium [&_em]:italic [&_em]:text-[var(--mp-ac)]",
          PLAN_FOCUS,
        )}
      >
        <ChevronLeft className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
        <span>{title}</span>
      </button>
    </div>
  );
}

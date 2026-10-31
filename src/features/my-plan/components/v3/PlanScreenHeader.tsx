"use client";

import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { PLAN_FOCUS } from "./planChipStyles";

const ROUND_BUTTON =
  "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)]";

/**
 * Шапка вложенного экрана «Мой план» v3: круглая «назад», подпись «• МОЙ ПЛАН / раздел», крупный
 * заголовок, необязательная мета-строка и круглое «закрыть».
 */
export function PlanScreenHeader({
  kicker = "Мой план",
  title,
  meta,
  onBack,
  onClose,
  backLabel = "Назад в план",
}: {
  kicker?: string;
  title: ReactNode;
  meta?: ReactNode;
  onBack: () => void;
  onClose?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-20 shrink-0 items-center gap-3 px-5 pb-1.5 pt-[26px] md:px-8">
      <button type="button" onClick={onBack} aria-label={backLabel} className={`${ROUND_BUTTON} ${PLAN_FOCUS}`}>
        <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="mp-font-meta m-0 flex items-center gap-2 text-[12.5px] font-medium uppercase leading-none tracking-[.16em] text-[var(--mp-ac-dark)]">
          <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--mp-ac-dark)]" />
          {kicker}
        </p>
        <h2 className="m-0 mt-1 text-[27px] font-extrabold leading-[1.1] tracking-[-.025em] text-[var(--mp-tx)]">{title}</h2>
        {meta ? (
          <p className="mp-font-meta m-0 mt-1.5 text-[11.5px] font-medium uppercase tracking-[.14em] text-[var(--mp-tx2)]">{meta}</p>
        ) : null}
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Закрыть мой план" className={`${ROUND_BUTTON} ${PLAN_FOCUS}`}>
          <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

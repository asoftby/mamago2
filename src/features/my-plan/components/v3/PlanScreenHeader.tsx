"use client";

import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { PLAN_FOCUS } from "./planChipStyles";

const ROUND_BUTTON =
  "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)]";

/**
 * Шапка вложенного экрана «Мой план» — тот же ритм, что у первого экрана (MyPlanHeader):
 * подпись Menlo 10px без точки на одной линии с круглыми кнопками, ниже заголовок 22px bold.
 * Заголовок — `<p>`, а не `<h2>`: общий CSS для заголовков принудительно меняет вес и шрифт.
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
    <div className="shrink-0 px-5 md:px-8">
      <div className="flex items-center gap-3 pb-1 pt-[26px]">
        <button type="button" onClick={onBack} aria-label={backLabel} className={`${ROUND_BUTTON} ${PLAN_FOCUS}`}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <p
          style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
          className="m-0 min-w-0 flex-1 truncate text-[10px] font-medium uppercase leading-none tracking-[.14em] text-[var(--mp-ac-dark)]"
        >
          {kicker}
        </p>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Закрыть мой план" className={`${ROUND_BUTTON} ${PLAN_FOCUS}`}>
            <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      <p
        className={`m-0 text-[22px] font-bold leading-[1.15] tracking-[-.01em] text-[var(--mp-tx)] [text-wrap:pretty] ${meta ? "mb-1.5" : "mb-[18px]"}`}
      >
        {title}
      </p>
      {meta ? (
        <p
          style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
          className="m-0 mb-[18px] text-[10px] font-medium uppercase tracking-[.1em] text-[var(--mp-tx2)]"
        >
          {meta}
        </p>
      ) : null}
    </div>
  );
}

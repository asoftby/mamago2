"use client";

import { X } from "lucide-react";

type MyPlanHeaderProps = {
  onClose?: () => void;
  compact?: boolean;
  /** Без минимальной высоты и нижнего отступа: заголовок экрана садится вплотную к подписи. */
  tight?: boolean;
};

export function MyPlanHeader({ onClose, compact = false, tight = false }: MyPlanHeaderProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 bg-[var(--mp-bg)]"
      style={
        tight
          ? { padding: compact ? "26px 18px 4px 20px" : "26px 24px 0 32px" }
          : { padding: compact ? "26px 18px 6px 20px" : "26px 24px 6px 32px", minHeight: 80 }
      }
    >
      <p
        style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
        className="m-0 text-[10px] font-medium uppercase leading-none tracking-[.14em] text-[var(--mp-ac-dark)]">
        Мой план
      </p>

      <button
        type="button"
        aria-label="Закрыть мой план"
        onClick={() => onClose?.()}
        className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)] ${tight ? "translate-y-7" : ""}`}
      >
        <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

"use client";

import { X } from "lucide-react";

type MyPlanHeaderProps = {
  onClose?: () => void;
  compact?: boolean;
};

export function MyPlanHeader({ onClose, compact = false }: MyPlanHeaderProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 bg-[var(--mp-bg)]"
      style={{ padding: compact ? "26px 18px 6px 20px" : "26px 24px 6px 32px", minHeight: 80 }}
    >
      <p
        style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
        className="m-0 flex items-center gap-2 text-[10px] font-medium uppercase leading-none tracking-[.14em] text-[var(--mp-ac-dark)]">
        <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--mp-ac-dark)]" />
        Мой план
      </p>

      <button
        type="button"
        aria-label="Закрыть мой план"
        onClick={() => onClose?.()}
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)]"
      >
        <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

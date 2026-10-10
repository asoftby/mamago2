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
      style={{ padding: compact ? "10px 12px 4px 20px" : "20px 20px 6px 32px", minHeight: 56 }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-sans)",
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-.025em",
          color: "var(--mp-tx)",
        }}
      >
        <span style={{ fontWeight: 400 }}>Мой</span>{" "}
        <em
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontWeight: 500,
            color: "var(--mp-ac)",
          }}
        >
          план
        </em>
      </h2>

      <button
        type="button"
        aria-label="Закрыть мой план"
        onClick={() => onClose?.()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mp-tx2)] transition-colors hover:bg-[var(--mp-soft)] hover:text-[var(--mp-tx)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mp-ac)]"
      >
        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

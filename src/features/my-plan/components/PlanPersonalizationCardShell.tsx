"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PlanPersonalizationCardShell({
  title,
  compact,
  children,
}: {
  title: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative z-0 rounded-[16px] border border-[rgba(20,18,16,0.08)] bg-[rgba(255,255,255,0.55)] px-3.5 py-3">
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.45)]">
          Режим подбора
        </p>
        <p
          className={cn(
            "text-[#141210]",
            compact ? "text-[15px] leading-[1.15]" : "text-[16px] leading-[1.15]",
          )}
          style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}
        >
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

export function PlanPersonalizationBodyText({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[rgba(20,18,16,0.58)]",
        compact ? "text-[12px] leading-[1.45]" : "text-[13px] leading-[1.45]",
      )}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {children}
    </p>
  );
}

export function PlanPersonalizationTextAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-[#EF8759] underline-offset-2 hover:underline"
    >
      {label}
    </button>
  );
}

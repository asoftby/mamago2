"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Повтор точек снизу строки; шаг задаётся в backgroundSize (первое число — расстояние между центрами точек). */
const DOT_LEADER_STYLE: CSSProperties = {
  flex: 1,
  minWidth: "0.75rem",
  minHeight: "6px",
  alignSelf: "flex-end",
  marginBottom: "0.2em",
  backgroundImage:
    "radial-gradient(circle at center, currentColor 1px, transparent 1px)",
  backgroundSize: "18px 4px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "left bottom",
};

export function PublicationStatsMetricRow({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
        <span className="shrink-0 text-muted-foreground">{label}</span>
        {/* Точки сопоставления: пунктир между подписью и числом */}
        <span
          aria-hidden
          className="hidden min-w-0 flex-1 text-muted-foreground/45 sm:block"
          style={DOT_LEADER_STYLE}
        />
        <span className="shrink-0 tabular-nums text-foreground/90 sm:text-right">
          {display}
        </span>
      </div>
      {hint ? (
        <p className="text-[10px] leading-snug text-muted-foreground/50">{hint}</p>
      ) : null}
    </div>
  );
}

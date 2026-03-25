"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PublicationStatsMetricRow } from "./PublicationStatsMetricRow";

export type MetricRowDef = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function PublicationStatsMetricGrid({
  rows,
  className,
}: {
  rows: MetricRowDef[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5 font-mono text-xs", className)}>
      {rows.map((row) => (
        <PublicationStatsMetricRow
          key={row.label}
          label={row.label}
          value={row.value}
          hint={row.hint}
        />
      ))}
    </div>
  );
}

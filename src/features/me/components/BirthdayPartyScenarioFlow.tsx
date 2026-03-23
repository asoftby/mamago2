"use client";

import type { PartyScenarioFlowUi } from "@/features/me/lib/partyScenarioFlow";
import { cn } from "@/lib/utils";

type BirthdayPartyScenarioFlowProps = {
  flow: PartyScenarioFlowUi;
};

/**
 * Однострочный сценарный flow: Место → Аниматор → …
 * Подтверждённые слоты — зелёным medium, остальные — muted.
 */
export function BirthdayPartyScenarioFlow({ flow }: BirthdayPartyScenarioFlowProps) {
  const { visible, overflowCount } = flow;

  return (
    <p
      className="min-w-0 text-[11px] leading-tight truncate whitespace-nowrap"
      aria-label="Сценарий праздника"
    >
      {visible.map((seg, i) => (
        <span key={`${seg.label}-${i}`}>
          {i > 0 ? (
            <span className="text-muted-foreground/45" aria-hidden>
              {" "}
              →{" "}
            </span>
          ) : null}
          <span
            className={cn(
              seg.confirmed
                ? "font-medium text-emerald-700"
                : "font-normal text-muted-foreground",
            )}
          >
            {seg.label}
          </span>
        </span>
      ))}
      {overflowCount > 0 ? (
        <>
          <span className="text-muted-foreground/45" aria-hidden>
            {" "}
            →{" "}
          </span>
          <span className="font-normal text-muted-foreground">
            + ещё {overflowCount}
          </span>
        </>
      ) : null}
    </p>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import type { SerializedPlanItem } from "./PlanPageClient";
import { PlanItemCard, type VisibilityChange } from "./PlanItemCard";
import { PlanEmptyDayMessage } from "@/features/my-plan/components/PlanEmptyDayMessage";
import type { FamilyView } from "@/features/my-plan/lib/planVisibilityView";
import { dayOfMonth, monthGenitive, weekdayFull } from "@/lib/date/dateKey";
import { resolveScenarioCtaState, resolveScenarioCtaLabel } from "@/features/my-plan/lib/canOpenDayScenario";

function formatDayLabel(dateStr: string): { weekday: string; day: number; month: string } {
  return { weekday: weekdayFull(dateStr), day: dayOfMonth(dateStr), month: monthGenitive(dateStr) };
}


type Props = {
  date: string;
  items: SerializedPlanItem[];
  participantNameById: ReadonlyMap<string, string>;
  onRemove: (id: string) => void;
  familyView?: FamilyView | null;
  onVisibilityChange?: VisibilityChange;
  onEditManual: (item: SerializedPlanItem) => void;
  conflictIds: ReadonlySet<string>;
  /** undefined = no Scenario yet for this date. */
  scenarioStatus?: "ready" | "changed";
};

function ScenarioCta({
  date,
  itemCount,
  scenarioStatus,
}: {
  date: string;
  itemCount: number;
  scenarioStatus?: "ready" | "changed";
}) {
  const state = resolveScenarioCtaState(itemCount, scenarioStatus);
  const label = resolveScenarioCtaLabel(state);
  if (!label || process.env.NEXT_PUBLIC_ENABLE_LEGACY_DAY_SCENARIO !== "true") return null;

  const href = `/minsk/my-plan/${date}/scenario`;

  return (
    <div style={{ marginTop: 10 }}>
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: scenarioStatus === "changed" ? "#B45309" : "#C24E22",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {label} →
      </Link>
    </div>
  );
}

export function PlanDayList({ date, items, participantNameById, onRemove, familyView, onVisibilityChange, onEditManual, conflictIds, scenarioStatus }: Props) {
  const { weekday, day, month } = formatDayLabel(date);

  return (
    <div>
      {/* Day header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <h2 className="m-0 text-[30px] font-bold leading-[1.15] tracking-[-0.025em] text-[#141210]">
            <span className="capitalize">{weekday}</span>, {day} {month}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {items.length > 0 && (
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11.5, letterSpacing: ".14em", color: "#6F675E" }}
              >
                {items.length} {items.length % 10 === 1 && items.length % 100 !== 11 ? "запись" : [2, 3, 4].includes(items.length % 10) && (items.length % 100 < 12 || items.length % 100 > 14) ? "записи" : "записей"}
              </span>
            )}
          </div>
        </div>
        <ScenarioCta date={date} itemCount={items.length} scenarioStatus={scenarioStatus} />
      </div>

      {/* Items or empty state */}
      {items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <PlanItemCard
              key={item.id}
              item={item}
              participantName={item.childId ? participantNameById.get(`child:${item.childId}`) : item.assigneeUserId ? participantNameById.get(`adult:${item.assigneeUserId}`) : undefined}
              onRemove={onRemove}
              onEdit={onEditManual}
              hasConflict={conflictIds.has(item.id)}
              familyView={familyView}
              onVisibilityChange={onVisibilityChange}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "36px 28px",
            background: "#F8F5EF",
            border: "1.5px dashed #DCD4C9",
            borderRadius: 24,
            textAlign: "center",
          }}
        >
          <p className="mb-6 text-[16px] leading-6 text-[#3A332B]">
            <PlanEmptyDayMessage />
          </p>
          <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/minsk"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 52, padding: "0 22px", borderRadius: 999,
                fontWeight: 600, fontSize: 14,
                background: "#141210", color: "#fff",
                border: "1px solid transparent",
                transition: "background .18s",
                textDecoration: "none",
              }}
            >
              Куда пойти →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

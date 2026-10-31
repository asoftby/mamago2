"use client";

import React from "react";
import Link from "next/link";
import type { SerializedPlanItem } from "./PlanPageClient";
import { PlanItemCard, type VisibilityChange } from "./PlanItemCard";
import type { FamilyView } from "@/features/my-plan/lib/planVisibilityView";
import { addDays, dayOfMonth, monthGenitive, todayKey, weekdayFull } from "@/lib/date/dateKey";
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
  /** «Для всех» / «Для меня» / «Для Степана» / «Для выбранных». */
  audienceLabel: string;
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

export function PlanDayList({ date, items, participantNameById, onRemove, familyView, onVisibilityChange, onEditManual, conflictIds, audienceLabel, scenarioStatus }: Props) {
  const { weekday, day, month } = formatDayLabel(date);
  const today = todayKey();

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
          <span
            style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
            className="min-w-0 truncate text-right text-[12px] text-[var(--text-muted)]"
          >
            {audienceLabel}
          </span>
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
        <p
          role="status"
          className="m-0 flex min-h-[76px] items-center justify-center rounded-[22px] border border-[#d6e4f3] bg-[#eaf2fb] px-4 py-3 text-center text-[15px] font-normal leading-[1.5] text-[var(--text-muted)]"
        >
          На {date === today ? "сегодня" : date === addDays(today, 1) ? "завтра" : "этот день"} планов нет.
        </p>
      )}
    </div>
  );
}

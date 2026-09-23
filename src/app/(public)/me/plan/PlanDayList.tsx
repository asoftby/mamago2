"use client";

import React from "react";
import Link from "next/link";
import type { SerializedPlanItem } from "./PlanPageClient";
import { PlanItemCard } from "./PlanItemCard";
import { resolveScenarioCtaState, resolveScenarioCtaLabel } from "@/features/my-plan/lib/canOpenDayScenario";

const MONTHS_RU_GENITIVE = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const DAYS_RU_FULL: Record<number, string> = {
  1: "Понедельник", 2: "Вторник", 3: "Среда",
  4: "Четверг", 5: "Пятница", 6: "Суббота", 0: "Воскресенье",
};

function formatDayLabel(dateStr: string): { weekday: string; day: number; month: string } {
  const date = new Date(dateStr + "T12:00:00");
  return {
    weekday: DAYS_RU_FULL[date.getDay()],
    day: date.getDate(),
    month: MONTHS_RU_GENITIVE[date.getMonth()],
  };
}

type Props = {
  date: string;
  items: SerializedPlanItem[];
  onRemove: (id: string) => void;
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
  if (!label) return null;

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

export function PlanDayList({ date, items, onRemove, scenarioStatus }: Props) {
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
          <h2
            className="font-sans"
            style={{
              margin: 0,
              fontSize: "clamp(32px, 4vw, 52px)",
              lineHeight: 1,
              letterSpacing: "-.025em",
              color: "#141210",
            }}
          >
            {weekday},{" "}
            <span className="font-display-italic" style={{ color: "var(--primary)" }}>
              {day} {month}
            </span>
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {items.length > 0 && (
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: ".12em", color: "rgba(20,18,16,.55)" }}
              >
                {items.length} {items.length === 1 ? "событие" : items.length <= 4 ? "события" : "событий"}
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
            <PlanItemCard key={item.id} item={item} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "40px 32px",
            background: "#FAF7F1",
            border: "1px dashed rgba(20,18,16,.18)",
            borderRadius: 18,
            textAlign: "center",
          }}
        >
          <h3
            className="font-sans"
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1,
              letterSpacing: "-.02em",
              color: "#141210",
            }}
          >
            Нет событий{" "}
            <span className="font-display-italic" style={{ color: "var(--primary)" }}>
              на этот день
            </span>
          </h3>
          <p
            style={{
              marginTop: 10,
              marginBottom: 24,
              fontSize: 15,
              color: "rgba(20,18,16,.55)",
              lineHeight: 1.5,
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Добавьте событие, место или идею, чтобы собрать план на{" "}
            {weekday.toLowerCase()}.
          </p>
          <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/minsk"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 50, padding: "0 22px", borderRadius: 999,
                fontWeight: 600, fontSize: 14,
                background: "#E86A3A", color: "#fff",
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

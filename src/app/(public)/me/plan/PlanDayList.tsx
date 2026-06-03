"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "@/lib/toast";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { SerializedPlanItem } from "./PlanPageClient";

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

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function PlanItemCard({
  item,
  onRemove,
}: {
  item: SerializedPlanItem;
  onRemove: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const title = item.activity?.title ?? item.title ?? "Активность";
  const time = formatTime(item.startsAt);
  const unavailable =
    item.planAvailability === "business_disabled" ||
    item.planAvailability === "missing_activity";

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/save/plan?planItemId=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        onRemove(item.id);
        toast("Убрано из плана", { duration: 2000 });
      }
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "88px 1fr auto",
        gap: 0,
        padding: "20px 24px",
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
        alignItems: "stretch",
        transition: "border-color .18s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,18,16,.28)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,18,16,.10)"; }}
    >
      {/* Left: time + dot */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 3 }}>
        {time ? (
          <>
            <span
              className="font-display"
              style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}
            >
              {time}
            </span>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: ".08em", color: "rgba(20,18,16,.55)" }}
            >
              {item.activity?.ageLabel ?? ""}
            </span>
          </>
        ) : (
          <span
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: ".08em", color: "rgba(20,18,16,.55)", marginTop: 4 }}
          >
            без времени
          </span>
        )}
        <span
          style={{
            marginTop: 8,
            width: 7,
            height: 7,
            borderRadius: 99,
            background: "#E86A3A",
            boxShadow: "0 0 0 3px rgba(232,106,58,.18)",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Center: body */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          minWidth: 0,
          paddingLeft: 18,
          borderLeft: "1px solid rgba(20,18,16,.10)",
          marginLeft: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {item.activity?.type && (
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: ".12em", color: "#C24E22" }}
            >
              ● {item.activity.type}
            </span>
          )}
          {unavailable && (
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 10, letterSpacing: ".08em",
                padding: "2px 7px", borderRadius: 99,
                background: "rgba(214,52,43,.08)", color: "#D6342B",
              }}
            >
              снято
            </span>
          )}
        </div>
        <h3
          className="font-display"
          style={{
            margin: 0,
            fontSize: 22,
            lineHeight: 1.05,
            letterSpacing: "-.015em",
            color: "#141210",
          }}
        >
          {title}
        </h3>
        {item.activity?.ageLabel && !time && (
          <span style={{ fontSize: 12, color: "rgba(20,18,16,.55)" }}>{item.activity.ageLabel}</span>
        )}
      </div>

      {/* Right: actions */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 10,
          paddingLeft: 16,
          minWidth: 100,
          flexShrink: 0,
        }}
      >
        <div />
        <div style={{ display: "flex", gap: 6 }}>
          {item.activityId && !unavailable && (
            <Link
              href={publicActivityPath(item.activityId, "minsk", item.activity?.slug)}
              style={{
                width: 34, height: 34, borderRadius: 99,
                border: "1px solid rgba(20,18,16,.18)",
                background: "transparent", color: "rgba(20,18,16,.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Открыть"
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
            </Link>
          )}
          <button
            onClick={handleRemove}
            disabled={removing}
            title="Убрать из плана"
            style={{
              width: 34, height: 34, borderRadius: 99,
              border: "1px solid rgba(20,18,16,.18)",
              background: "transparent", color: "rgba(20,18,16,.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: removing ? "default" : "pointer",
              opacity: removing ? 0.4 : 1,
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  date: string;
  items: SerializedPlanItem[];
  onRemove: (id: string) => void;
};

export function PlanDayList({ date, items, onRemove }: Props) {
  const { weekday, day, month } = formatDayLabel(date);

  return (
    <div>
      {/* Day header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <h2
          className="font-display"
          style={{
            margin: 0,
            fontSize: "clamp(32px, 4vw, 52px)",
            lineHeight: 1,
            letterSpacing: "-.025em",
            color: "#141210",
          }}
        >
          {weekday},{" "}
          <span style={{ fontStyle: "italic", color: "#C24E22" }}>
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
            className="font-display"
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1,
              letterSpacing: "-.02em",
              color: "#141210",
            }}
          >
            Нет событий{" "}
            <span style={{ fontStyle: "italic", color: "#C24E22" }}>
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

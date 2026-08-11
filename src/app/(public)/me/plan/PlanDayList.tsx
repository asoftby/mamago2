"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "@/lib/toast";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { SerializedPlanItem } from "./PlanPageClient";
import { formatHHMM } from "@/lib/formatters/date";
import { BYN_SYMBOL, formatPriceAmount, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { BelarusianRubleIcon, renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
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

/** HH:mm from ISO string; shared formatter for consistency across plan views. */
function formatTime(iso: string | null): string | null {
  return formatHHMM(iso) || null;
}

function PlanItemPriceDisplay({ priceLabel }: { priceLabel: string }) {
  if (priceLabel.toLowerCase() === "бесплатно") {
    return <span className="uppercase">{priceLabel}</span>;
  }

  const stripped = priceLabel
    .replace(/^от\s+/i, "")
    .split(BYN_SYMBOL)
    .join("")
    .trim();
  const amount = formatPriceAmount(stripped);
  if (amount) {
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.18em" }}>
        <span>{amount}</span>
        <BelarusianRubleIcon size="sm" />
      </span>
    );
  }

  return <span>{renderCurrencyText(normalizeUiCurrencyText(priceLabel), { iconSize: "sm" })}</span>;
}

function PlanItemMeta({ item }: { item: SerializedPlanItem }) {
  const category = item.activity?.categoryLabel?.trim();
  const priceLabel = item.activity?.priceLabel?.trim();
  if (!category && !priceLabel) return null;

  const metaStyle = {
    fontSize: 10,
    letterSpacing: ".12em",
    color: "var(--primary)",
  } as const;

  return (
    <span className="font-mono inline-flex items-center gap-[0.35em] flex-wrap" style={metaStyle}>
      {category && <span className="uppercase">{category}</span>}
      {category && priceLabel && <span aria-hidden>·</span>}
      {priceLabel && <PlanItemPriceDisplay priceLabel={priceLabel} />}
    </span>
  );
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
        alignItems: "center",
        transition: "border-color .18s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,18,16,.28)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(20,18,16,.10)"; }}
    >
      {/* Left: time + dot */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
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
          <PlanItemMeta item={item} />
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
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 16,
          minWidth: 100,
          flexShrink: 0,
        }}
      >
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

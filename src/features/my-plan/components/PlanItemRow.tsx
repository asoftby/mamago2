"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, StickyNote, X } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";
import type { PlanItemWithActivity } from "../types/event";

interface PlanItemRowProps {
  item: PlanItemWithActivity;
  onRemove: () => void;
  participantLabel?: string | null;
}

export type PlanItemVisualKind = "event" | "note";

export function planItemVisualKind(
  item: Pick<PlanItemWithActivity, "source">,
): PlanItemVisualKind {
  return item.source === "MANUAL" || item.source === "TELEGRAM_FORWARD"
    ? "note"
    : "event";
}

const twoLineTitleStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
  whiteSpace: "normal" as const,
  wordBreak: "break-word" as const,
};

/**
 * Compact plan row. Destructive actions are explicit: no swipe/long-press
 * gestures on touch devices. The remove control is always visible on mobile
 * and appears on hover/focus on pointer layouts.
 */
export function PlanItemRow({ item, onRemove, participantLabel }: PlanItemRowProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;

  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;
  const participationCta = item.activity
    ? resolveActivityParticipationCta(item.activity, city)
    : null;
  const location = item.activity ? formatActivityAddressLine(item.activity) : null;
  const title = item.title || item.activity?.title || "Активность";
  const timeStr = item.startsAt
    ? new Date(item.startsAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const visualKind = planItemVisualKind(item);
  const VisualIcon = visualKind === "event" ? CalendarDays : StickyNote;
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="group"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "54px 38px minmax(0,1fr) auto",
          gap: 10,
          alignItems: "center",
          minHeight: 94,
          padding: "15px 12px",
          background: "#FAF7F1",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: timeStr ? 13 : 11,
            fontWeight: 500,
            letterSpacing: timeStr ? ".01em" : ".04em",
            color: "rgba(20,18,16,.55)",
            lineHeight: 1.25,
          }}
        >
          {timeStr ?? "В течение дня"}
        </span>

        <span
          aria-label={visualKind === "event" ? "Событие" : "Заметка"}
          title={visualKind === "event" ? "Событие" : "Заметка"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: visualKind === "event" ? "#C24E22" : "#C98A19",
            background: visualKind === "event" ? "#FFF0EA" : "#FFF4D9",
          }}
        >
          <VisualIcon size={19} />
        </span>

        <span style={{ minWidth: 0 }}>
          {activityDetailHref ? (
            <Link
              href={activityDetailHref}
              style={{
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-.005em",
                lineHeight: 1.28,
                color: "#141210",
                textDecoration: "none",
                ...twoLineTitleStyle,
              }}
            >
              {title}
            </Link>
          ) : (
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-.005em",
                lineHeight: 1.28,
                color: "#141210",
                ...twoLineTitleStyle,
              }}
            >
              {title}
            </span>
          )}

          {location ? (
            <span
              style={{
                display: "block",
                fontSize: 13,
                color: "rgba(20,18,16,.55)",
                marginTop: 5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {location}
            </span>
          ) : null}

          {participantLabel ? (
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                color: "rgba(20,18,16,.48)",
                marginTop: 4,
              }}
            >
              {participantLabel}
            </span>
          ) : null}
        </span>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {participationCta ? (
            participationCta.external ? (
              <a
                href={participationCta.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  minHeight: 34,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: "1px solid rgba(20,18,16,.18)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#3A332B",
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                }}
              >
                {participationCta.label}
              </a>
            ) : (
              <Link
                href={participationCta.href}
                style={{
                  minHeight: 34,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: "1px solid rgba(20,18,16,.18)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#3A332B",
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                }}
              >
                {participationCta.label}
              </Link>
            )
          ) : null}

          <button
            type="button"
            onClick={onRemove}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={`Убрать «${title}» из плана`}
            className={
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border " +
              "border-[rgba(20,18,16,.18)] bg-[#FAF7F1] text-[rgba(20,18,16,.55)] " +
              "opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 " +
              (focused ? "md:opacity-100" : "")
            }
          >
            <X size={15} />
          </button>
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, StickyNote, X } from "lucide-react";
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

const ctaStyle = {
  minHeight: 30,
  padding: "0 11px",
  borderRadius: 999,
  border: "1px solid rgba(20,18,16,.16)",
  fontSize: 12,
  fontWeight: 600,
  color: "#3A332B",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  textDecoration: "none",
  background: "#fff",
} as const;

export function PlanItemRow({ item, onRemove, participantLabel }: PlanItemRowProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;
  const participationCta = item.activity
    ? resolveActivityParticipationCta(item.activity, city)
    : null;
  const location =
    item.locationText?.trim() ||
    (item.activity ? formatActivityAddressLine(item.activity) : null);
  const title = item.title || item.activity?.title || "Запись";
  const timeStr = item.startsAt
    ? new Date(item.startsAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "В течение дня";
  const visualKind = planItemVisualKind(item);
  const VisualIcon = visualKind === "event" ? CalendarDays : StickyNote;
  const [focused, setFocused] = useState(false);

  const titleNode = activityDetailHref ? (
    <Link
      href={activityDetailHref}
      style={{
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "-.012em",
        lineHeight: 1.25,
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
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "-.012em",
        lineHeight: 1.25,
        color: "#141210",
        ...twoLineTitleStyle,
      }}
    >
      {title}
    </span>
  );

  return (
    <div
      className="group"
      style={{
        position: "relative",
        borderRadius: 18,
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.06)",
        padding: "15px 14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px minmax(0,1fr) 32px",
          gap: 12,
          alignItems: "start",
        }}
      >
        <span
          aria-label={visualKind === "event" ? "Событие" : "Заметка"}
          title={visualKind === "event" ? "Событие" : "Заметка"}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: visualKind === "event" ? "#C24E22" : "#C98A19",
            background: visualKind === "event" ? "#FFF0EA" : "#FFF4D9",
          }}
        >
          <VisualIcon size={20} />
        </span>

        <div style={{ minWidth: 0 }}>
          {titleNode}

          {location ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                minWidth: 0,
                marginTop: 6,
                fontSize: 13,
                color: "rgba(20,18,16,.55)",
              }}
            >
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {location}
              </span>
            </span>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px 10px",
              marginTop: 8,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12.5,
                color: "rgba(20,18,16,.58)",
              }}
            >
              <Clock3 size={13} />
              {timeStr}
            </span>

            {participantLabel ? (
              <span style={{ fontSize: 12.5, color: "rgba(20,18,16,.48)" }}>
                {participantLabel}
              </span>
            ) : null}

            {participationCta ? (
              participationCta.external ? (
                <a
                  href={participationCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={ctaStyle}
                >
                  {participationCta.label}
                </a>
              ) : (
                <Link href={participationCta.href} style={ctaStyle}>
                  {participationCta.label}
                </Link>
              )
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={`Убрать «${title}» из плана`}
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border " +
            "border-[rgba(20,18,16,.14)] bg-white/75 text-[rgba(20,18,16,.55)] " +
            "opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 " +
            (focused ? "md:opacity-100" : "")
          }
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

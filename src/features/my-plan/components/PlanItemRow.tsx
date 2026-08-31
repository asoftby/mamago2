"use client";

import { useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import { X, Trash2 } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";
import type { PlanItemWithActivity } from "../types/event";

const REVEAL_WIDTH = 96;
const SWIPE_OPEN_THRESHOLD = REVEAL_WIDTH / 2;
const LONG_PRESS_MS = 480;
const MOVE_INTENT_PX = 6;

interface PlanItemRowProps {
  item: PlanItemWithActivity;
  onRemove: () => void;
}

/**
 * The concealed "Убрать" panel sits underneath the row at all times; while
 * it's not revealed it must be unreachable by keyboard and invisible to
 * assistive tech, or a Tab press lands on a destructive action the user
 * can't see. `tabIndex`/`aria-hidden` are the pair that make both true.
 */
export function getConcealedDeleteA11yProps(revealed: boolean): { tabIndex: number; "aria-hidden": boolean } {
  return { tabIndex: revealed ? 0 : -1, "aria-hidden": !revealed };
}

/**
 * A long-press that opens the reveal panel is followed by a browser-
 * synthesized click on touchend (no pointer movement to suppress it). That
 * synthetic click must not immediately re-close the panel it just opened —
 * it should be consumed once, silently. Any other click while revealed
 * (a deliberate follow-up tap, or a click while the swipe-opened panel is
 * showing) should still close it as before.
 */
export function decideRowClickCapture(
  revealed: boolean,
  suppressNextClick: boolean,
): { consumeSuppress: boolean; shouldClose: boolean } {
  if (suppressNextClick) {
    return { consumeSuppress: true, shouldClose: false };
  }
  return { consumeSuppress: false, shouldClose: revealed };
}

/**
 * Compact plan-item row (~72px): time -> title/location -> ticket CTA if
 * the activity has one. No persistent delete button in the resting state —
 * deletion reveals via swipe-left / long-press on touch, and via
 * hover-or-focus on pointer devices (the transparent X button below is
 * always in the DOM, just invisible until hovered/focused, so keyboard and
 * screen-reader users can still reach it by tabbing).
 */
export function PlanItemRow({ item, onRemove }: PlanItemRowProps) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;

  const activityDetailHref = item.activity?.id
    ? publicActivityPath(item.activity.id, city, item.activity.slug)
    : null;
  const participationCta = item.activity ? resolveActivityParticipationCta(item.activity, city) : null;
  const location = item.activity ? formatActivityAddressLine(item.activity) : null;
  const title = item.title || item.activity?.title || "Активность";
  const timeStr = item.startsAt
    ? new Date(item.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const closeReveal = () => {
    setDragX(0);
    setRevealed(false);
  };

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    draggingRef.current = false;
    suppressNextClickRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setDragX(-REVEAL_WIDTH);
      setRevealed(true);
      suppressNextClickRef.current = true;
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const start = touchStartRef.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!draggingRef.current) {
      if (Math.abs(dx) < MOVE_INTENT_PX && Math.abs(dy) < MOVE_INTENT_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll intent — let the page scroll, don't treat as a swipe.
        touchStartRef.current = null;
        clearLongPress();
        return;
      }
      draggingRef.current = true;
      setIsDragging(true);
      clearLongPress();
    }

    if (dx <= 0) setDragX(Math.max(dx, -REVEAL_WIDTH));
  };

  const handleTouchEnd = () => {
    clearLongPress();
    if (draggingRef.current) {
      if (dragX <= -SWIPE_OPEN_THRESHOLD) {
        setDragX(-REVEAL_WIDTH);
        setRevealed(true);
      } else {
        closeReveal();
      }
    }
    touchStartRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);
  };

  const showDeleteAffordance = hovered || focused || revealed;

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
      {/* Swipe-reveal delete panel underneath the row */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#D6342B",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 18,
        }}
      >
        <button
          type="button"
          {...getConcealedDeleteA11yProps(revealed)}
          onClick={() => {
            onRemove();
            closeReveal();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 6px",
            background: "none",
            border: 0,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <Trash2 size={16} />
          Убрать
        </button>
      </div>

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClickCapture={(e) => {
          const decision = decideRowClickCapture(revealed, suppressNextClickRef.current);
          if (decision.consumeSuppress) {
            suppressNextClickRef.current = false;
            e.preventDefault();
            return;
          }
          if (decision.shouldClose) {
            e.preventDefault();
            closeReveal();
          }
        }}
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "46px 1fr auto",
          gap: 11,
          alignItems: "center",
          minHeight: 72,
          padding: "11px 12px",
          background: "#FAF7F1",
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform .28s cubic-bezier(.2,.7,.2,1)",
          touchAction: "pan-y",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: timeStr ? 13 : 11,
            fontWeight: 500,
            letterSpacing: timeStr ? ".01em" : ".04em",
            color: "rgba(20,18,16,.55)",
            lineHeight: 1.2,
          }}
        >
          {timeStr ?? "весь день"}
        </span>

        <span style={{ minWidth: 0 }}>
          {activityDetailHref ? (
            <Link
              href={activityDetailHref}
              style={{
                display: "block",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-.005em",
                lineHeight: 1.25,
                color: "#141210",
                textDecoration: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </Link>
          ) : (
            <span
              style={{
                display: "block",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-.005em",
                lineHeight: 1.25,
                color: "#141210",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
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
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {location}
            </span>
          ) : null}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {participationCta ? (
            participationCta.external ? (
              <a
                href={participationCta.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 32,
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
                  height: 32,
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
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid rgba(20,18,16,.18)",
              background: "#FAF7F1",
              color: "rgba(20,18,16,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              opacity: showDeleteAffordance ? 1 : 0,
              pointerEvents: showDeleteAffordance ? "auto" : "none",
              transition: "opacity .15s",
            }}
          >
            <X size={15} />
          </button>
        </span>
      </div>
    </div>
  );
}

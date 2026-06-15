"use client";

import React, { useState, useCallback } from "react";
import { getTodayStart } from "@/lib/date/getTodayStart";
import {
  getPlanReminderLabel,
  PLAN_REMINDER_LABELS,
  resolvePlanEventDateTime,
} from "@/lib/plan/getPlanReminderLabel";

// ─── Types ────────────────────────────────────────────────────────────────────
type Session = {
  date: string; // YYYY-MM-DD
  startsAt?: string; // ISO string
};

type ScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  activityTitle: string;
  sessions: Session[];
  onSaveIdea: () => Promise<void>;
  onSchedule: (date: string, startsAt?: string) => Promise<void>;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#F6F2EA",
  paper: "#FAF7F1",
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RU_MONTHS_SHORT = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const RU_MONTHS_FULL  = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const RU_DAYS_SHORT   = ["вс","пн","вт","ср","чт","пт","сб"];
const RU_DAYS_FULL    = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLong(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const dow = RU_DAYS_FULL[d.getDay()];
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}

function fmtDateShort(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}

function fmtDateChip(dateStr: string) {
  const d = parseLocalDate(dateStr);
  return {
    dow: RU_DAYS_SHORT[d.getDay()],
    day: String(d.getDate()).padStart(2, "0"),
    month: RU_MONTHS_SHORT[d.getMonth()],
    monthFull: RU_MONTHS_FULL[d.getMonth()],
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CalIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function BookmarkIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PlusIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

/** Italic serif "или …" divider */
function OrDivider({ label = "или" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 14px" }}>
      <span style={{ flex: 1, height: 1, background: C.line }} />
      <span style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontStyle: "italic", fontSize: 16, color: C.ink3 }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

/** Monospace label + line */
function KickerLine({ label, mt = 18, mb = 10 }: { label: string; mt?: number; mb?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: mt, marginBottom: mb }}>
      <span style={{
        fontFamily: "var(--font-mono, ui-monospace)",
        textTransform: "uppercase",
        fontSize: 10,
        letterSpacing: ".14em",
        color: C.ink3,
        whiteSpace: "nowrap",
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

/** Event chip at top of modal */
function EventChip({ title }: { title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px 10px 10px",
      background: C.paper, border: `1px solid ${C.line}`,
      borderRadius: 16, marginBottom: 18,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 99,
        background: C.accentSoft, color: C.accentDeep,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>✱</span>
      <span style={{
        fontSize: 14, color: C.ink, fontWeight: 600, letterSpacing: "-.01em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{title}</span>
    </div>
  );
}

/** Numbered option row */
function OptRow({
  num,
  iconEl,
  title,
  sub,
  onClick,
  disabled,
}: {
  num: string;
  iconEl: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="sm-opt-row"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "14px 16px",
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-sans)",
        transition: "all .22s ease",
      }}
    >
      <span style={{
        minWidth: 22,
        fontFamily: "var(--font-mono, ui-monospace)",
        fontSize: 11,
        color: C.ink3,
        letterSpacing: ".1em",
        alignSelf: "center",
      }}>{num}</span>
      {iconEl}
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: C.ink }}>{title}</div>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>{sub}</div>
      </span>
      <span className="sm-opt-arr" style={{ fontSize: 16, color: C.ink3, transition: "all .22s", flexShrink: 0 }}>→</span>
    </button>
  );
}

/** Icon circle */
function IcoCircle({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      width: 42, height: 42, borderRadius: 99,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: bg, color, flexShrink: 0,
    }}>{children}</span>
  );
}

/** Сохранить в идеи row (always at bottom) */
function IdeasRow({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="sm-opt-row"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "14px 16px",
        background: "transparent",
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)",
        transition: "all .22s ease",
      }}
    >
      <IcoCircle bg={C.bg} color={C.ink2}>
        <BookmarkIcon size={17} />
      </IcoCircle>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: C.ink }}>Сохранить в идеи</div>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>Вернуться к этому позже — без конкретного дня</div>
      </span>
      <span className="sm-opt-arr" style={{ fontSize: 16, color: C.ink3, transition: "all .22s", flexShrink: 0 }}>→</span>
    </button>
  );
}

// ─── Phase A: editorial (0–1 sessions) ───────────────────────────────────────
function PhaseEditorial({
  sessions,
  activityTitle,
  onScheduleSession,
  onCustomDate,
  onIdeas,
  isLoading,
}: {
  sessions: Session[];
  activityTitle: string;
  onScheduleSession: (s: Session) => void;
  onCustomDate: () => void;
  onIdeas: () => void;
  isLoading: boolean;
}) {
  const hasSessions = sessions.length > 0;
  const first = sessions[0];

  const sub1 = first
    ? `${fmtDateLong(first.date)}${first.startsAt ? ` · ${fmtTime(first.startsAt)}` : ""}`
    : "";
  const reminderHint = first
    ? getPlanReminderLabel({
        eventDateTime: resolvePlanEventDateTime(first.date, first.startsAt ?? null),
      }) ?? PLAN_REMINDER_LABELS.eveningBefore
    : PLAN_REMINDER_LABELS.eveningBefore;

  return (
    <>
      <EventChip title={activityTitle} />

      <h2 style={{
        margin: 0,
        fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
        fontSize: 36,
        lineHeight: 1,
        letterSpacing: "-.02em",
        fontWeight: 400,
      }}>
        Куда сохранить{" "}
        <span style={{ fontStyle: "italic", color: C.accentDeep }}>активность</span>?
      </h2>
      <p style={{ marginTop: 10, marginBottom: 22, fontSize: 14, color: C.ink3, lineHeight: 1.5 }}>
        {hasSessions
          ? `Положите в план на дату — ${reminderHint}. Или сохраните в идеи.`
          : "Сохраните в идеи, чтобы вернуться к этому позже."}
      </p>

      {hasSessions && (
        <>
          <KickerLine label="в план" mt={0} mb={10} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <OptRow
              num="01"
              iconEl={<IcoCircle bg={C.ink} color="#FAF7F1"><CalIcon size={17} color="#FAF7F1" /></IcoCircle>}
              title="Ближайшая дата"
              sub={sub1}
              onClick={() => onScheduleSession(first)}
              disabled={isLoading}
            />
            {sessions.length === 1 && (
              <OptRow
                num="02"
                iconEl={<IcoCircle bg={C.bg} color={C.ink2}><CalIcon size={17} /></IcoCircle>}
                title="Выбрать дату"
                sub="Указать другой удобный день"
                onClick={onCustomDate}
                disabled={isLoading}
              />
            )}
          </div>
          <OrDivider label="или" />
        </>
      )}

      <KickerLine label="без даты" mt={0} mb={10} />
      <IdeasRow onClick={onIdeas} disabled={isLoading} />
    </>
  );
}

// ─── Phase B: date chips (2+ sessions) ───────────────────────────────────────
const CHIPS_VISIBLE = 5;

function PhaseChips({
  sessions,
  activityTitle,
  onScheduleSession,
  onIdeas,
  isLoading,
}: {
  sessions: Session[];
  activityTitle: string;
  onScheduleSession: (s: Session) => void;
  onIdeas: () => void;
  isLoading: boolean;
}) {
  const [selIdx, setSelIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? sessions : sessions.slice(0, CHIPS_VISIBLE);
  const hidden = sessions.length - CHIPS_VISIBLE;

  const selected = sessions[selIdx] ?? sessions[0];
  const selChip = fmtDateChip(selected.date);

  const confirmLabel = `Добавить в план — ${selChip.dow}, ${parseInt(selChip.day)} ${selChip.monthFull}${selected.startsAt ? ` · ${fmtTime(selected.startsAt)}` : ""}`;

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          textTransform: "uppercase" as const,
          fontSize: 10,
          letterSpacing: ".14em",
          color: C.accentDeep,
          display: "inline-block",
          marginBottom: 12,
        }}>● сохранить активность</span>
        <h2 style={{
          margin: 0,
          fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: "-.02em",
          fontWeight: 400,
        }}>
          Когда{" "}
          <span style={{ fontStyle: "italic", color: C.accentDeep }}>планируете</span>{" "}
          пойти?
        </h2>
        <p style={{ marginTop: 10, marginBottom: 16, fontSize: 13, color: C.ink3, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            textTransform: "uppercase" as const,
            fontSize: 10,
            letterSpacing: ".14em",
            color: C.accentDeep,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: C.accent, flexShrink: 0 }} />
            мероприятие
          </span>
          <span style={{ color: C.line2 }}>·</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{activityTitle}</span>
        </p>
      </div>

      {/* Date chip strip */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
        margin: "0 -2px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}>
        {visible.map((session, i) => {
          const chip = fmtDateChip(session.date);
          const isSel = i === selIdx;
          return (
            <button
              key={i}
              onClick={() => setSelIdx(i)}
              disabled={isLoading}
              style={{
                flexShrink: 0,
                padding: "10px 13px",
                borderRadius: 14,
                background: isSel ? C.ink : C.paper,
                border: `1px solid ${isSel ? C.ink : C.line}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                minWidth: 72,
                cursor: "pointer",
                transition: "all .18s",
                color: isSel ? "#FAF7F1" : C.ink,
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono, ui-monospace)",
                fontSize: 10,
                color: isSel ? "rgba(250,247,241,.6)" : C.ink3,
                letterSpacing: ".12em",
                textTransform: "uppercase" as const,
              }}>{chip.dow}</span>
              <span style={{
                fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
                fontSize: 26,
                lineHeight: 1,
                letterSpacing: "-.02em",
              }}>{chip.day}</span>
              <span style={{
                fontSize: 11,
                color: isSel ? "rgba(250,247,241,.6)" : C.ink3,
              }}>{chip.month}</span>
              {session.startsAt && (
                <span style={{
                  fontFamily: "var(--font-mono, ui-monospace)",
                  fontSize: 10,
                  color: isSel ? "rgba(250,247,241,.7)" : C.ink3,
                  marginTop: 3,
                }}>{fmtTime(session.startsAt)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Show all button */}
      {!showAll && hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: "100%",
            padding: "11px 14px",
            marginTop: 10,
            background: "transparent",
            border: `1px dashed ${C.line2}`,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: C.ink2,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99,
              border: `1px solid ${C.line2}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <PlusIcon size={12} />
            </span>
            Показать ещё {hidden} {hidden === 1 ? "сеанс" : hidden < 5 ? "сеанса" : "сеансов"}
          </span>
          <span style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 11,
            color: C.ink3,
          }}>всего {sessions.length} →</span>
        </button>
      )}

      {/* Confirm CTA */}
      <button
        onClick={() => onScheduleSession(selected)}
        disabled={isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          marginTop: 14,
          height: 52,
          borderRadius: 999,
          background: isLoading ? C.accentDeep : C.accent,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          border: 0,
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "background .2s",
          fontFamily: "var(--font-sans)",
          opacity: isLoading ? 0.8 : 1,
        }}
      >
        {isLoading ? "Сохраняем…" : confirmLabel}
        {!isLoading && <ArrowRightIcon color="#fff" size={16} />}
      </button>

      <OrDivider label="или просто отметить" />
      <IdeasRow onClick={onIdeas} disabled={isLoading} />
    </>
  );
}

// ─── Phase C: custom date picker ──────────────────────────────────────────────
function PhaseCustomDate({
  onBack,
  onSchedule,
  isLoading,
}: {
  onBack: () => void;
  onSchedule: (date: string) => void;
  isLoading: boolean;
}) {
  const [date, setDate] = useState("");
  const minDate = getTodayStart().toISOString().split("T")[0];
  const calendarReminderHint = date
    ? getPlanReminderLabel({ eventDateTime: resolvePlanEventDateTime(date) }) ??
      PLAN_REMINDER_LABELS.eveningBefore
    : PLAN_REMINDER_LABELS.eveningBefore;

  return (
    <>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 20,
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase" as const,
          color: C.ink3,
          background: "none",
          border: 0,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <ChevronLeftIcon size={13} color={C.ink3} />
        Назад
      </button>

      <h2 style={{
        margin: "0 0 6px",
        fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
        fontSize: 34,
        lineHeight: 1,
        letterSpacing: "-.02em",
        fontWeight: 400,
      }}>
        Выберите{" "}
        <span style={{ fontStyle: "italic", color: C.accentDeep }}>дату</span>
      </h2>
      <p style={{ marginTop: 8, marginBottom: 22, fontSize: 14, color: C.ink3, lineHeight: 1.5 }}>
        Добавим в план и {calendarReminderHint}.
      </p>

      <div style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 14,
      }}>
        <label style={{
          display: "block",
          fontFamily: "var(--font-mono, ui-monospace)",
          textTransform: "uppercase" as const,
          fontSize: 10,
          letterSpacing: ".14em",
          color: C.ink3,
          marginBottom: 10,
        }}>дата</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={minDate}
          style={{
            width: "100%",
            border: 0,
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            color: C.ink,
            outline: "none",
            cursor: "pointer",
          }}
        />
      </div>

      <button
        onClick={() => date && onSchedule(date)}
        disabled={isLoading || !date}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          height: 52,
          borderRadius: 999,
          background: !date || isLoading ? C.line2 : C.accent,
          color: !date || isLoading ? C.ink3 : "#fff",
          fontSize: 15,
          fontWeight: 600,
          border: 0,
          cursor: !date || isLoading ? "not-allowed" : "pointer",
          transition: "all .2s",
          fontFamily: "var(--font-sans)",
        }}
      >
        {isLoading ? "Сохраняем…" : date ? `Добавить в план — ${fmtDateShort(date)}` : "Выберите дату"}
        {!isLoading && date && <ArrowRightIcon color="#fff" size={16} />}
      </button>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ScheduleModal({
  isOpen,
  onClose,
  activityId: _activityId,
  activityTitle,
  sessions,
  onSaveIdea,
  onSchedule,
}: ScheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"main" | "custom">("main");

  // Reset phase when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) setPhase("main");
  }, [isOpen]);

  const sortedSessions = React.useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
    [sessions],
  );

  const handleIdeas = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSaveIdea();
      onClose();
    } catch (err) {
      console.error("Failed to save idea:", err);
    } finally {
      setIsLoading(false);
    }
  }, [onSaveIdea, onClose]);

  const handleScheduleSession = useCallback(async (session: Session) => {
    setIsLoading(true);
    try {
      await onSchedule(session.date, session.startsAt);
      onClose();
    } catch (err) {
      console.error("Failed to schedule:", err);
    } finally {
      setIsLoading(false);
    }
  }, [onSchedule, onClose]);

  const handleCustomDate = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      await onSchedule(date);
      onClose();
    } catch (err) {
      console.error("Failed to schedule:", err);
    } finally {
      setIsLoading(false);
    }
  }, [onSchedule, onClose]);

  if (!isOpen) return null;

  const useChips = sortedSessions.length >= 2;

  return (
    <>
      {/* CSS for hover effects */}
      <style>{`
        .sm-opt-row:hover:not(:disabled) {
          background: #fff !important;
          border-color: ${C.ink} !important;
          transform: translateX(2px);
        }
        .sm-opt-row:hover:not(:disabled) .sm-opt-arr {
          transform: translateX(4px);
          color: ${C.accentDeep} !important;
        }
        .sm-modal::-webkit-scrollbar { display: none; }
        .sm-modal { scrollbar-width: none; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,18,16,.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 50,
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 51,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        pointerEvents: "none",
      }}>
        <div
          className="sm-modal"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 500,
            maxHeight: "90svh",
            overflowY: "auto",
            background: C.bg,
            border: `1px solid ${C.line}`,
            borderRadius: 24,
            padding: "28px 28px 24px",
            boxShadow: "0 1px 0 rgba(255,255,255,.6) inset, 0 40px 80px -20px rgba(0,0,0,.55)",
            pointerEvents: "auto",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 34,
              height: 34,
              borderRadius: 99,
              border: `1px solid ${C.line2}`,
              color: C.ink2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              fontSize: 14,
              cursor: "pointer",
              transition: "all .2s",
              lineHeight: 1,
              fontFamily: "var(--font-sans)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.ink;
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.ink;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = C.ink2;
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.line2;
            }}
          >
            ✕
          </button>

          {/* Phase content */}
          {phase === "custom" ? (
            <PhaseCustomDate
              onBack={() => setPhase("main")}
              onSchedule={handleCustomDate}
              isLoading={isLoading}
            />
          ) : useChips ? (
            <PhaseChips
              sessions={sortedSessions}
              activityTitle={activityTitle}
              onScheduleSession={handleScheduleSession}
              onIdeas={handleIdeas}
              isLoading={isLoading}
            />
          ) : (
            <PhaseEditorial
              sessions={sortedSessions}
              activityTitle={activityTitle}
              onScheduleSession={handleScheduleSession}
              onCustomDate={() => setPhase("custom")}
              onIdeas={handleIdeas}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </>
  );
}

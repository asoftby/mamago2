"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "@/lib/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
} from "@/lib/date/localDateKey";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { PlanReminderCaption } from "@/components/plan/PlanReminderCaption";
import {
  getPlanReminderLabelFromPlanItem,
  PLAN_REMINDER_LABELS,
} from "@/lib/plan/getPlanReminderLabel";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#FFFFFF",
  paper: "#FAF7F1",
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
  green: "#1F8A5B",
  greenBg: "rgba(31,138,91,.12)",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export type SaveScenario =
  | { kind: "confirm"; title: string; dateLabel: string; timeLabel: string; dateISO: string; slotId?: string | null }
  | { kind: "timeslots"; title: string; dateLabel: string; dateISO: string; slots: { id: string; label: string }[] }
  | {
      kind: "quickdate";
      title: string;
      eventPlanDateISO?: string;
      eventPlanDateEndISO?: string;
      eventPlanDateOptions?: string[];
      /**
       * Session slots per date: { "YYYY-MM-DD": [{ id, time: "HH:mm" }, ...] }
       * Used to render time chips. Session counts are derived from this.
       */
      eventPlanSessionsByDate?: Record<string, Array<{ id: string; time: string }>>;
      /**
       * Entity has no date semantics (e.g. Article) — render idea-only UI,
       * no calendar/date-slider/"or without date" ever, regardless of any
       * legacy inPlan/planDate state.
       */
      ideaOnly?: boolean;
    };

export type SaveToPlanResult =
  | { action: "plan"; dateISO: string; timeSlotId?: string | null }
  | { action: "ideas" }
  | { action: "remove-idea" }
  | { action: "remove-plan"; planItemId: string }
  | { action: "cancel" };

export interface SaveToPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: SaveScenario;
  onConfirm: (result: SaveToPlanResult) => void;
  isIdea?: boolean;
  inPlan?: boolean;
  planDate?: string | null;
  planStartsAt?: string | null;
  source?: string;
}

export interface SaveToPlanPickerBodyProps {
  scenario: SaveScenario;
  onCommit: (result: SaveToPlanResult) => void;
  isIdea?: boolean;
  inPlan?: boolean;
  planDate?: string | null;
  planStartsAt?: string | null;
  planItemId?: string | null;
  source?: string;
  /** Закрыть контейнер */
  onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RU_MONTHS_SHORT = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const RU_MONTHS_FULL  = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const RU_MONTHS_NAMED = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const RU_DAYS_SHORT   = ["вс","пн","вт","ср","чт","пт","сб"];
const RU_DAYS_FULL    = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

function pluralDat(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дат";
  if (mod10 === 1) return "дата";
  if (mod10 >= 2 && mod10 <= 4) return "даты";
  return "дат";
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function formatSessionDotsLabel(count: number): string {
  if (count >= 3) return "3 или больше сеансов в этот день";
  return `${count} ${pluralRu(count, ["сеанс", "сеанса", "сеансов"])} в этот день`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDateChip(iso: string) {
  const d = parseLocalDate(iso);
  return {
    dow: RU_DAYS_SHORT[d.getDay()],
    day: String(d.getDate()),
    month: RU_MONTHS_SHORT[d.getMonth()],
    monthIdx: d.getMonth(),
    year: d.getFullYear(),
  };
}

function fmtDateLong(iso: string): string {
  const d = parseLocalDate(iso);
  const dow = RU_DAYS_FULL[d.getDay()];
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}

function fmtDateShort(iso: string): string {
  const d = parseLocalDate(iso);
  return `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}

function normalizePlanDateISO(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
}

function isLongRunningRange(s?: string | null, e?: string | null): boolean {
  const start = normalizePlanDateISO(s);
  const end = normalizePlanDateISO(e);
  return !!(start && end && end > start);
}

function formatEventRangeSubtitle(s?: string | null, e?: string | null): string | null {
  const start = normalizePlanDateISO(s);
  const end = normalizePlanDateISO(e);
  if (!start || !end) return null;
  return `${formatRuShortDayMonth(start)} — ${formatRuShortDayMonth(end)}`;
}

function buildDateRangeKeys(s?: string | null, e?: string | null): string[] {
  const start = normalizePlanDateISO(s);
  const end = normalizePlanDateISO(e);
  if (!start || !end || end < start) return [];
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = addDaysLocal(cursor, 1);
  }
  return keys;
}

function toastPlan(dateISO: string) {
  toast.success("Добавлено в план", {
    description: `Активность сохранена на ${formatLocalPlanDate(dateISO, "ru-RU")}`,
    action: { label: "Открыть план", onClick: () => { window.location.href = "/me/plan"; } },
    duration: 4000,
  });
}
function toastIdea() {
  toast.success("Сохранено в идеи", {
    description: "Вы сможете вернуться к этому позже",
    action: { label: "Открыть идеи", onClick: () => { window.location.href = "/me/ideas"; } },
    duration: 4000,
  });
}
function toastRemovedIdea() { toast("Убрано из идей", { duration: 2500 }); }

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

function ArrowIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
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

function TrashIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function PencilIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function KickerLine({ label, rightEl }: { label: string; rightEl?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <span style={{
        fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase",
        fontSize: 10, letterSpacing: ".14em", color: C.ink3, whiteSpace: "nowrap",
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
      {rightEl}
    </div>
  );
}

function OrDivider({ label = "или" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0 14px" }}>
      <span style={{ flex: 1, height: 1, background: C.line }} />
      <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontSize: 16, color: C.ink3 }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

function IcoCircle({ bg, color, border, children }: { bg: string; color: string; border?: string; children: React.ReactNode }) {
  return (
    <span style={{
      width: 42, height: 42, borderRadius: 99, display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      background: bg, color, flexShrink: 0, border: border ?? "none",
    }}>{children}</span>
  );
}

function OptRow({ num, iconEl, title, sub, onClick }: {
  num: string; iconEl: React.ReactNode; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button className="stp-opt" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14,
      width: "100%", padding: "14px 16px",
      background: C.paper, border: `1px solid ${C.line}`,
      borderRadius: 16, textAlign: "left", cursor: "pointer",
      fontFamily: "var(--font-sans, ui-sans-serif)", transition: "all .22s ease",
    }}>
      <span style={{ minWidth: 22, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: C.ink3, letterSpacing: ".1em", alignSelf: "center" }}>{num}</span>
      {iconEl}
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: C.ink }}>{title}</div>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>{sub}</div>
      </span>
      <span className="stp-arr" style={{ fontSize: 16, color: C.ink3, transition: "all .22s", flexShrink: 0 }}>→</span>
    </button>
  );
}

function IdeasRow({
  onClick, title = "Сохранить в идеи",
  subtitle = "Вернуться к этому позже — без конкретного дня",
}: {
  onClick: () => void; title?: string; subtitle?: string;
}) {
  return (
    <button className="stp-opt" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14,
      width: "100%", padding: "14px 16px",
      background: C.paper, border: `1px solid ${C.line}`,
      borderRadius: 16, textAlign: "left", cursor: "pointer",
      fontFamily: "var(--font-sans, ui-sans-serif)", transition: "all .22s ease",
    }}>
      <IcoCircle bg={C.bg} color={C.ink2} border={`1px solid ${C.line2}`}><BookmarkIcon size={17} /></IcoCircle>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: C.ink }}>{title}</div>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>{subtitle}</div>
      </span>
      <span className="stp-arr" style={{ fontSize: 16, color: C.ink3, transition: "all .22s", flexShrink: 0 }}>→</span>
    </button>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
/** Returns HH:mm string for current local time, e.g. "14:05". */
function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Pick default session for a date.
 *  - today: first slot that hasn't passed yet; if all past → last slot.
 *  - any other day: first slot (earliest).
 *  - no slots: null.
 */
function defaultSessionId(
  iso: string,
  sessions: Array<{ id: string; time: string }> | undefined,
): string | null {
  if (!sessions || sessions.length === 0) return null;
  if (sessions.length === 1) return sessions[0]!.id;
  const todayISO = getLocalDateKey();
  if (iso === todayISO) {
    const now = currentHHMM();
    const upcoming = sessions.filter((s) => s.time > now);
    return upcoming.length > 0 ? upcoming[0]!.id : sessions[sessions.length - 1]!.id;
  }
  return sessions[0]!.id;
}

// ─── Date Slider (Variant B) ──────────────────────────────────────────────────
interface DateSliderProps {
  options: string[];  // YYYY-MM-DD sorted upcoming
  selISO: string | null;
  onSelect: (iso: string) => void;
  sessionCountsByDate?: Record<string, number>;
}

function DateSlider({ options, selISO, onSelect, sessionCountsByDate }: DateSliderProps) {
  const sliderRef = React.useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    sliderRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  // Scroll selected into view
  React.useEffect(() => {
    if (!selISO || !sliderRef.current) return;
    const el = sliderRef.current.querySelector<HTMLElement>(`[data-iso="${selISO}"]`);
    if (!el) return;
    const c = sliderRef.current;
    const er = el.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    if (er.left < cr.left + 40 || er.right > cr.right - 40) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selISO]);

  return (
    <div style={{ position: "relative", marginBottom: 2 }}>
      {/* Arrows */}
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          onClick={() => scrollBy(side === "left" ? -1 : 1)}
          aria-label={side === "left" ? "Назад" : "Вперёд"}
          style={{
            position: "absolute", [side]: -2, top: "50%", transform: "translateY(-50%)", zIndex: 2,
            width: 32, height: 32, borderRadius: 99,
            background: C.paper, border: `1px solid ${C.line2}`,
            color: C.ink, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 10px rgba(20,18,16,.06)",
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            {side === "left"
              ? <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      ))}

      {/* Fade edges */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 36, background: `linear-gradient(90deg, ${C.bg}, transparent)`, pointerEvents: "none", zIndex: 1 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 36, background: `linear-gradient(270deg, ${C.bg}, transparent)`, pointerEvents: "none", zIndex: 1 }} />

      {/* Track */}
      <div
        ref={sliderRef}
        style={{
          display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden",
          padding: "4px 20px", scrollSnapType: "x proximity", scrollbarWidth: "none",
        }}
      >
        <style>{`.stp-slider::-webkit-scrollbar{display:none}`}</style>
        {options.map((iso) => {
          const chip = fmtDateChip(iso);
          const isSel = iso === selISO;
          const sessionsCount = sessionCountsByDate?.[iso] ?? 0;
          const dotsCount = Math.min(sessionsCount, 3);
          const dotsLabel = sessionsCount > 0 ? formatSessionDotsLabel(sessionsCount) : null;
          return (
            <button
              key={iso}
              data-iso={iso}
              onClick={() => onSelect(iso)}
              style={{
                flexShrink: 0, scrollSnapAlign: "center",
                width: 76, padding: "10px 8px 10px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: isSel ? C.ink : C.paper,
                color: isSel ? "#FAF7F1" : C.ink,
                border: `1px solid ${isSel ? C.ink : C.line}`,
                borderRadius: 14, cursor: "pointer",
                transition: "all .15s", position: "relative",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.ink; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.line; }}
            >
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: isSel ? "rgba(250,247,241,.6)" : C.ink3 }}>{chip.dow}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1, letterSpacing: "-.02em" }}>{chip.day}</span>
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 9, letterSpacing: ".08em", color: isSel ? "rgba(250,247,241,.55)" : C.ink3 }}>{chip.month}</span>
              {dotsCount > 0 ? (
                <span
                  aria-label={dotsLabel ?? undefined}
                  title={dotsLabel ?? undefined}
                  style={{ display: "flex", gap: 3, minHeight: 5, alignItems: "center", marginTop: 1 }}
                >
                  {Array.from({ length: dotsCount }, (_, di) => (
                    <span key={di} style={{ width: 4, height: 4, borderRadius: 99, background: C.accent }} />
                  ))}
                </span>
              ) : (
                <span aria-hidden="true" style={{ minHeight: 5, marginTop: 1 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time chip row ────────────────────────────────────────────────────────────
function ClockIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

interface TimeChipRowProps {
  sessions: Array<{ id: string; time: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TimeChipRow({ sessions, selectedId, onSelect }: TimeChipRowProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);

  // No sessions → "по записи" info line
  if (sessions.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 7, marginTop: 12,
        padding: "10px 14px", borderRadius: 12,
        background: C.paper, border: `1px solid ${C.line}`,
        fontSize: 13, color: C.ink3, fontFamily: "var(--font-sans, ui-sans-serif)",
      }}>
        <ClockIcon size={14} color={C.ink3} />
        <span>Время по записи — уточните у организатора</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
        fontSize: 10, letterSpacing: ".12em", color: C.ink3, marginBottom: 6,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <ClockIcon size={11} color={C.ink3} /> время начала
      </div>
      <div
        ref={trackRef}
        style={{
          display: "flex", gap: 6,
          overflowX: "auto", overflowY: "hidden",
          flexWrap: "nowrap" as const,
          scrollbarWidth: "none" as const,
          padding: "2px 0 4px",
        }}
      >
        <style>{`.stp-time-track::-webkit-scrollbar{display:none}`}</style>
        {sessions.map((s) => {
          const isSel = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              style={{
                flexShrink: 0,
                height: 40, padding: "0 14px",
                borderRadius: 999,
                background: isSel ? C.accent : C.paper,
                color: isSel ? "#fff" : C.ink,
                border: `1px solid ${isSel ? C.accent : C.line}`,
                fontFamily: "var(--font-mono, ui-monospace)",
                fontSize: 13, fontWeight: 600, letterSpacing: ".03em",
                cursor: "pointer", transition: "all .15s",
                display: "flex", alignItems: "center",
                whiteSpace: "nowrap" as const,
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.ink2; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.line; }}
            >
              {s.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dark confirmation bar ────────────────────────────────────────────────────
function ConfirmBar({ iso, time, onConfirm }: { iso: string; time?: string | null; onConfirm: () => void }) {
  const chip = fmtDateChip(iso);
  const DOW_FULL: Record<string, string> = {
    вс: "Воскресенье", пн: "Понедельник", вт: "Вторник",
    ср: "Среда", чт: "Четверг", пт: "Пятница", сб: "Суббота",
  };
  return (
    <div style={{
      marginTop: 14, padding: "14px 16px",
      background: C.ink, color: "#FAF7F1", borderRadius: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".1em", color: "rgba(250,247,241,.55)", marginBottom: 3 }}>● выбрано</div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>
          {DOW_FULL[chip.dow] ?? chip.dow},{" "}
          <span style={{ fontFamily: "var(--font-display)" }}>{chip.day}</span>{" "}
          {RU_MONTHS_FULL[chip.monthIdx]}
          {time && (
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 13, fontWeight: 500, color: "rgba(250,247,241,.75)", marginLeft: 6 }}>
              · {time}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onConfirm}
        aria-label="Добавить в план"
        style={{
          height: 46, padding: "0 20px", borderRadius: 999,
          background: C.accent, color: "#fff",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0, cursor: "pointer", border: 0,
          fontSize: 14, fontWeight: 600, letterSpacing: "-.01em",
          fontFamily: "var(--font-sans, ui-sans-serif)",
          transition: "transform .18s",
          whiteSpace: "nowrap",
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(.94)"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
      >
        Сохранить
        <ArrowIcon size={14} color="#fff" />
      </button>
    </div>
  );
}

// ─── All-dates drawer (MoreD style) ──────────────────────────────────────────
interface AllDatesDrawerProps {
  options: string[];
  selISO: string | null;
  onSelect: (iso: string) => void;
  onBack: () => void;
}

function AllDatesDrawer({ options, selISO, onSelect, onBack }: AllDatesDrawerProps) {
  // Group by month
  const byMonth = React.useMemo(() => {
    const map = new Map<string, string[]>();
    options.forEach((iso) => {
      const d = parseLocalDate(iso);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(iso);
    });
    return Array.from(map.entries()).map(([key, dates]) => {
      const [y, m] = key.split("-").map(Number);
      return { label: `${RU_MONTHS_NAMED[m]} ${y !== new Date().getFullYear() ? y : ""}`.trim(), dates };
    });
  }, [options]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 5,
      background: C.bg, borderRadius: "inherit",
      padding: "24px 24px 18px", display: "flex", flexDirection: "column",
      animation: "stp-slide-up .35s cubic-bezier(.2,.7,.2,1) both",
    }}>
      <style>{`@keyframes stp-slide-up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button
          onClick={onBack}
          aria-label="Назад"
          style={{
            width: 36, height: 36, borderRadius: 99,
            background: "transparent", border: `1px solid ${C.line2}`,
            color: C.ink2, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0, transition: "all .15s",
          }}
          onMouseEnter={(e) => { const b = e.currentTarget as HTMLElement; b.style.background = C.ink; b.style.color = "#FAF7F1"; b.style.borderColor = C.ink; }}
          onMouseLeave={(e) => { const b = e.currentTarget as HTMLElement; b.style.background = "transparent"; b.style.color = C.ink2; b.style.borderColor = C.line2; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: "var(--primary)" }}>● Все даты</span>
          <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 24, letterSpacing: "-.015em", fontWeight: 600 }}>
            {options.length}{" "}
            <span style={{ fontFamily: "var(--font-editorial)", color: "var(--primary)", fontStyle: "italic", fontWeight: 500 }}>
              {pluralRu(options.length, ["сеанс", "сеанса", "сеансов"])}
            </span>
          </h3>
        </div>
      </div>

      {/* Scrollable month groups */}
      <div style={{ flex: 1, overflowY: "auto", marginRight: -8, paddingRight: 8 }}>
        {byMonth.map(({ label, dates }) => (
          <div key={label} style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
              fontSize: 10, letterSpacing: ".14em", color: C.ink3, marginBottom: 8,
            }}>{label} · {dates.length}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dates.map((iso) => {
                const chip = fmtDateChip(iso);
                const isSel = iso === selISO;
                const isWeekend = chip.dow === "сб" || chip.dow === "вс";
                const dowColor = isWeekend
                  ? "var(--primary)"
                  : isSel
                    ? "rgba(250,247,241,.55)"
                    : C.ink3;
                return (
                  <button
                    key={iso}
                    onClick={() => onSelect(iso)}
                    style={{
                      padding: "10px 12px", borderRadius: 14,
                      background: isSel ? C.ink : C.paper,
                      color: isSel ? "#FAF7F1" : C.ink,
                      border: `1px solid ${isSel ? C.ink : C.line}`,
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                      minWidth: 64, cursor: "pointer", transition: "all .15s",
                      fontFamily: "var(--font-sans)",
                    }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.ink; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = C.line; }}
                  >
                    <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" as const, color: dowColor }}>{chip.dow}</span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 24, lineHeight: 1, letterSpacing: "-.02em" }}>{chip.day}</span>
                    <span style={{ fontSize: 11, color: isSel ? "rgba(250,247,241,.55)" : C.ink3 }}>{chip.month}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm CTA */}
      {selISO && (
        <button
          onClick={() => onBack()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", marginTop: 12, height: 50,
            borderRadius: 999, background: C.accent, color: "#fff",
            fontSize: 14, fontWeight: 600, border: 0, cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Выбрать — {fmtDateShort(selISO)} <ArrowIcon size={14} color="#fff" />
        </button>
      )}
    </div>
  );
}

// ─── Date Slider View (Variant B) ─────────────────────────────────────────────
function DateSliderView({
  options, title, category,
  onConfirm, onIdea, sessionsByDate,
}: {
  options: string[]; title: string; category?: string;
  onConfirm: (iso: string, sessionId: string | null) => void; onIdea: () => void;
  sessionsByDate?: Record<string, Array<{ id: string; time: string }>>;
}) {
  const [selISO, setSelISO] = React.useState<string>(options[0] ?? "");
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(() =>
    defaultSessionId(options[0] ?? "", sessionsByDate?.[options[0] ?? ""])
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const FIRST = 5;
  const visible = options.slice(0, FIRST);
  const hidden = options.length - FIRST;

  // Derive session counts (single source of truth = sessionsByDate)
  const sessionCountsByDate = React.useMemo(() => {
    if (!sessionsByDate) return {};
    return Object.fromEntries(
      Object.entries(sessionsByDate).map(([d, ss]) => [d, ss.length])
    );
  }, [sessionsByDate]);

  // When date changes, recompute default time slot for that date
  const handleDateSelect = React.useCallback((iso: string) => {
    setSelISO(iso);
    setSelectedSessionId(defaultSessionId(iso, sessionsByDate?.[iso]));
  }, [sessionsByDate]);

  const handleDrawerBack = () => { setDrawerOpen(false); };

  // Sessions for currently selected date
  const currentSessions = selISO && sessionsByDate ? (sessionsByDate[selISO] ?? []) : [];

  // HH:mm of the selected session (for ConfirmBar display)
  const selectedTime = selectedSessionId
    ? (currentSessions.find((s) => s.id === selectedSessionId)?.time ?? null)
    : null;

  return (
    <>
      <div style={{ padding: "24px 24px 20px" }}>
        {/* Kicker */}
        <span style={{
          fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
          fontSize: 10, letterSpacing: ".14em", color: C.accentDeep,
          display: "inline-block", marginBottom: 12,
        }}>● сохранить активность</span>

        {/* Heading */}
        <h2 style={{
          margin: "0 0 8px",
          fontFamily: "var(--font-sans)",
          fontSize: 30, lineHeight: 1.02, letterSpacing: "-.02em", fontWeight: 400,
        }}>
          В какой{" "}
          <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "var(--primary)" }}>день</span>{" "}
          напомнить.
        </h2>

        {/* Event context line */}
        <p style={{
          marginTop: 8, marginBottom: 18, fontSize: 13, color: C.ink3,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const,
        }}>
          {category && (
            <>
              <span style={{
                fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
                fontSize: 11, letterSpacing: ".14em", color: C.accentDeep,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: C.accent }} />
                {category}
              </span>
              <span style={{ color: C.line2 }}>·</span>
            </>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{title}</span>
        </p>

        {/* Month label + session count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 18, letterSpacing: "-.01em", fontWeight: 400 }}>
            {RU_MONTHS_NAMED[fmtDateChip(options[0]).monthIdx]}{" "}
            <span style={{ fontFamily: "var(--font-display)", color: C.ink3 }}>{parseLocalDate(options[0]).getFullYear()}</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, color: C.ink3, letterSpacing: ".1em", textTransform: "uppercase" as const }}>
            {options.length} {pluralDat(options.length)}
          </span>
        </div>

        {/* Date slider */}
        <DateSlider
          options={visible}
          selISO={selISO}
          onSelect={handleDateSelect}
          sessionCountsByDate={sessionCountsByDate}
        />

        {/* Time chips — only rendered when sessionsByDate is provided */}
        {sessionsByDate && (
          <TimeChipRow
            sessions={currentSessions}
            selectedId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />
        )}

        {/* Show all dates button */}
        {hidden > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: "100%", padding: "11px 14px", marginTop: 10,
              background: "transparent", border: `1px dashed ${C.line2}`,
              borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
              color: C.ink2, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)",
              transition: "border-color .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.ink; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line2; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 24, height: 24, borderRadius: 99, border: `1px solid ${C.line2}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <PlusIcon size={12} />
              </span>
              Показать все {options.length} дат
            </span>
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: C.ink3 }}>
              до {fmtDateShort(options[options.length - 1])} →
            </span>
          </button>
        )}

        {/* Confirmation bar */}
        {selISO && (
          <ConfirmBar
            iso={selISO}
            time={selectedTime}
            onConfirm={() => onConfirm(selISO, selectedSessionId)}
          />
        )}

        <OrDivider label="или без даты" />
        <IdeasRow onClick={onIdea} />
      </div>

      {/* All-dates drawer */}
      {drawerOpen && (
        <AllDatesDrawer
          options={options}
          selISO={selISO}
          onSelect={handleDateSelect}
          onBack={handleDrawerBack}
        />
      )}
    </>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────
function CalendarView({ onSelect, allowedDateKeys, onBack }: {
  onSelect: (iso: string) => void; allowedDateKeys?: string[] | null; onBack?: () => void;
}) {
  const [value, setValue] = React.useState<Date | null>(null);
  const selectedDateISO = value ? getLocalDateKey(value) : null;
  const calendarReminderHint = selectedDateISO
    ? getPlanReminderLabelFromPlanItem({ planDate: selectedDateISO }) ?? PLAN_REMINDER_LABELS.eveningBefore
    : PLAN_REMINDER_LABELS.eveningBefore;

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      {onBack && (
        <button onClick={onBack} style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20,
          fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".12em",
          textTransform: "uppercase" as const, color: C.ink3, background: "none", border: 0, cursor: "pointer", padding: 0,
        }}>‹ Назад</button>
      )}
      <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-sans)", fontSize: 34, lineHeight: 1, letterSpacing: "-.02em", fontWeight: 600 }}>
        Выберите <span style={{ fontStyle: "italic", color: C.accentDeep }}>дату</span>
      </h2>
      <p style={{ marginTop: 8, marginBottom: 22, fontSize: 14, color: C.ink3, lineHeight: 1.5 }}>
        Добавим в план и {calendarReminderHint}.
      </p>
      <DatePicker value={value} onDateChange={setValue} disablePast allowedDateKeys={allowedDateKeys} />
      <button
        onClick={() => value && onSelect(getLocalDateKey(value))}
        disabled={!value}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", marginTop: 16, height: 52, borderRadius: 999,
          background: value ? C.accent : C.line, color: value ? "#fff" : C.ink3,
          fontSize: 15, fontWeight: 600, border: 0,
          cursor: value ? "pointer" : "not-allowed", transition: "all .2s", fontFamily: "var(--font-sans)",
        }}
      >
        {value ? `В план — ${fmtDateLong(getLocalDateKey(value))}` : "Выберите дату"}
        {value && <ArrowIcon color="#fff" size={16} />}
      </button>
    </div>
  );
}

// ─── Already in plan state (Variant E) ───────────────────────────────────────
function InPlanView({ planDate, planStartsAt, planItemId, onSwitchCalendar, onRemovePlan, onClose }: {
  planDate: string | null; planStartsAt: string | null; planItemId: string | null;
  onSwitchCalendar: () => void;
  onRemovePlan: (planItemId: string) => void; onClose: () => void;
}) {
  const planDateFmt = planDate ? formatLocalPlanDate(planDate, "ru-RU") : null;

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      {/* Green kicker */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 99, background: C.green, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, boxShadow: `0 0 0 4px ${C.greenBg}`,
        }}>✓</span>
        <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: C.green }}>уже сохранено</span>
      </div>

      <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-sans)", fontSize: 30, lineHeight: 1, letterSpacing: "-.02em", fontWeight: 600 }}>
        В вашем{" "}
        <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "var(--primary)" }}>плане</span>.
      </h2>

      {/* Бейдж — derived от planDate */}
      {planDateFmt && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 99, background: C.ink, color: "#FAF7F1",
            fontSize: 12, fontWeight: 500,
          }}>
            <CalIcon size={13} color="#FAF7F1" /> В плане · {planDateFmt}
          </span>
        </div>
      )}

      {/* Секция «В плане» */}
      <KickerLine label="в плане" rightEl={
        <button
          onClick={onSwitchCalendar}
          style={{
            fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
            fontSize: 10, letterSpacing: ".12em", color: "var(--primary)",
            background: "none", border: 0, cursor: "pointer", padding: 0,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        ><PlusIcon size={11} color="var(--primary)" /> ещё дату</button>
      } />

      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 14px 14px 16px",
          background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14,
        }}>
          <IcoCircle bg={C.ink} color="#FAF7F1"><CalIcon size={16} color="#FAF7F1" /></IcoCircle>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.005em", color: C.ink, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" as const }}>
              {planDateFmt ?? "Дата не указана"}
              {planStartsAt && (
                <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 12, color: C.ink3, fontWeight: 400 }}>
                  · {new Date(planStartsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            {planDate && (
              <PlanReminderCaption
                planDate={planDate}
                planStartsAt={planStartsAt}
                style={{ color: C.ink3 }}
              />
            )}
          </div>
          <button onClick={onSwitchCalendar} title="Изменить дату" style={{
            width: 32, height: 32, borderRadius: 99, border: `1px solid ${C.line2}`,
            background: "transparent", color: C.ink2,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><PencilIcon size={13} /></button>
          {/* Удалить из плана → API-запрос → закрыть модалку */}
          <button onClick={() => planItemId ? onRemovePlan(planItemId) : onClose()} title="Убрать из плана" style={{
            width: 32, height: 32, borderRadius: 99, border: `1px solid ${C.line2}`,
            background: "transparent", color: C.ink3,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><TrashIcon size={13} /></button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <button onClick={() => { window.location.href = "/me/plan"; }} style={{
          width: "100%", height: 46, borderRadius: 999, background: C.ink, color: "#FAF7F1",
          border: 0, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          cursor: "pointer", fontFamily: "var(--font-sans)",
        }}>
          Перейти в план <ExternalLinkIcon size={13} color="#FAF7F1" />
        </button>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => { window.location.href = "/me/ideas"; }}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              color: "var(--primary)",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            Мои идеи <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Already in ideas state (VariantEIdeas) ───────────────────────────────────
function InIdeasView({ onRemoveIdea, onSchedule, dateOptions }: {
  onRemoveIdea: () => void; onSchedule: (iso: string) => void; dateOptions: string[];
}) {
  const [removed, setRemoved] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [selISO, setSelISO] = React.useState<string>(dateOptions[0] ?? "");

  const handleRemove = () => { setRemoved(true); onRemoveIdea(); };

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      {/* Green kicker */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 99, background: C.green, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, boxShadow: `0 0 0 4px ${C.greenBg}`,
        }}>✓</span>
        <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: C.green }}>уже сохранено</span>
      </div>

      <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-sans)", fontSize: 36, lineHeight: 1, letterSpacing: "-.02em", fontWeight: 600 }}>
        В ваших{" "}
        <span style={{ fontStyle: "italic", color: C.accentDeep }}>идеях</span>.
      </h2>

      {/* Status chip */}
      {!removed && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 99, background: C.accentSoft, color: C.accentDeep,
            fontSize: 12, fontWeight: 500,
          }}>
            <BookmarkIcon size={13} /> В идеях
          </span>
        </div>
      )}

      {/* Idea entry */}
      {!removed ? (
        <>
          <KickerLine label="в идеях" />
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 14px 14px 16px",
              background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14,
            }}>
              <IcoCircle bg={C.accentSoft} color={C.accentDeep}><BookmarkIcon size={16} /></IcoCircle>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.005em", color: C.ink }}>Без даты</div>
                <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: C.ink3, marginTop: 3, letterSpacing: ".04em" }}>● без напоминания</div>
              </div>
              <button onClick={handleRemove} title="Убрать из идей" style={{
                width: 32, height: 32, borderRadius: 99, border: `1px solid ${C.line2}`,
                background: "transparent", color: C.ink3,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}><TrashIcon size={13} /></button>
            </div>
          </div>
        </>
      ) : (
        <div style={{
          padding: "24px 20px", background: C.paper, border: `1px dashed ${C.line2}`,
          borderRadius: 14, textAlign: "center", marginBottom: 18,
        }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, lineHeight: 1.1, color: C.ink, marginBottom: 6 }}>
            Пока ничего <span style={{ fontStyle: "italic", color: C.accentDeep }}>не сохранено</span>
          </div>
          <div style={{ fontSize: 13, color: C.ink3 }}>Добавьте дату в план или сохраните в идеи.</div>
        </div>
      )}

      {/* Nudge: convert to plan */}
      {!removed && (
        <div style={{
          padding: "16px 18px", borderRadius: 16,
          background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
          border: "1px solid rgba(232,106,58,.2)",
          display: "flex", alignItems: "center", gap: 14, marginBottom: 18,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.1, letterSpacing: "-.01em", fontWeight: 400 }}>
              Готовы <span style={{ fontStyle: "italic", color: C.accentDeep }}>выбрать день</span>?
            </div>
            {dateOptions.length > 0 && (
              <div style={{ fontSize: 12, color: C.ink3, marginTop: 3 }}>
                {dateOptions.length} дат · ближайшая {fmtDateShort(dateOptions[0])}
              </div>
            )}
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              height: 42, padding: "0 16px", borderRadius: 999,
              background: C.accent, color: "#fff", border: 0,
              fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--font-sans)",
            }}
          >
            Запланировать <ArrowIcon size={14} color="#fff" />
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <button onClick={() => { window.location.href = "/me/ideas"; }} style={{
          flex: 1, height: 46, borderRadius: 999, background: C.ink, color: "#FAF7F1",
          border: 0, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          cursor: "pointer", fontFamily: "var(--font-sans)",
        }}>
          Все мои идеи <ExternalLinkIcon size={13} color="#FAF7F1" />
        </button>
      </div>

      {/* Inline date-picker drawer */}
      {pickerOpen && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          background: C.bg, borderRadius: "inherit",
          padding: "24px 24px 18px", display: "flex", flexDirection: "column",
          animation: "stp-slide-up .35s cubic-bezier(.2,.7,.2,1) both",
        }}>
          <style>{`@keyframes stp-slide-up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <button
              onClick={() => setPickerOpen(false)}
              aria-label="Назад"
              style={{
                width: 36, height: 36, borderRadius: 99,
                background: "transparent", border: `1px solid ${C.line2}`,
                color: C.ink2, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0, transition: "all .15s",
              }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLElement; b.style.background = C.ink; b.style.color = "#FAF7F1"; b.style.borderColor = C.ink; }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLElement; b.style.background = "transparent"; b.style.color = C.ink2; b.style.borderColor = C.line2; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: C.accentDeep }}>● Выбор даты</span>
              <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 24, letterSpacing: "-.015em", fontWeight: 600 }}>
                {dateOptions.length}{" "}
                <span style={{ fontFamily: "var(--font-editorial)", color: "var(--primary)", fontStyle: "italic", fontWeight: 500 }}>
                  {pluralRu(dateOptions.length, ["сеанс", "сеанса", "сеансов"])}
                </span>
              </h3>
            </div>
          </div>

          {/* Date list grouped by month */}
          {dateOptions.length > 0 ? (
            <div style={{ flex: 1, overflowY: "auto", marginRight: -8, paddingRight: 8 }}>
              {/* Simple chip grid */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {dateOptions.map((iso) => {
                  const chip = fmtDateChip(iso);
                  const isSel = iso === selISO;
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelISO(iso)}
                      style={{
                        padding: "10px 12px", borderRadius: 14,
                        background: isSel ? C.ink : C.paper,
                        color: isSel ? "#FAF7F1" : C.ink,
                        border: `1px solid ${isSel ? C.ink : C.line}`,
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        minWidth: 64, cursor: "pointer", transition: "all .15s", fontFamily: "var(--font-sans)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" as const, color: isSel ? "rgba(250,247,241,.55)" : C.ink3 }}>{chip.dow}</span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 24, lineHeight: 1, letterSpacing: "-.02em" }}>{chip.day}</span>
                      <span style={{ fontSize: 11, color: isSel ? "rgba(250,247,241,.55)" : C.ink3 }}>{chip.month}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <CalendarView
              onSelect={(iso) => { setSelISO(iso); }}
              onBack={undefined}
            />
          )}

          {selISO && (
            <button
              onClick={() => { onSchedule(selISO); setPickerOpen(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", height: 50, marginTop: 12,
                borderRadius: 999, background: C.accent, color: "#fff",
                fontSize: 14, fontWeight: 600, border: 0, cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              Добавить в план — {fmtDateShort(selISO)} <ArrowIcon size={14} color="#fff" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Editorial quick view (Variant A) ────────────────────────────────────────
function EditorialView({
  scenario, isIdea, inPlan, onPlan, onIdea, onSwitchCalendar, dateOptions,
}: {
  scenario: SaveScenario; isIdea: boolean; inPlan: boolean;
  onPlan: (iso: string) => void; onIdea: () => void; onSwitchCalendar: () => void;
  dateOptions: string[];
}) {
  const todayISO = getLocalDateKey();
  const tomorrowISO = addDaysLocal(todayISO, 1);
  const eventPlanDateISO = normalizePlanDateISO(scenario.kind === "quickdate" ? scenario.eventPlanDateISO ?? null : null);
  const eventPlanDateEndISO = normalizePlanDateISO(scenario.kind === "quickdate" ? scenario.eventPlanDateEndISO ?? null : null);
  const isLongRunning = isLongRunningRange(eventPlanDateISO, eventPlanDateEndISO);
  const rangeLabel = formatEventRangeSubtitle(eventPlanDateISO, eventPlanDateEndISO);
  const isSingleDate = Boolean(eventPlanDateISO) && !isLongRunning;
  const upcomingOptions = dateOptions.filter((d) => d >= todayISO);
  const reminderHint =
    getPlanReminderLabelFromPlanItem({ planDate: upcomingOptions[0] ?? tomorrowISO }) ??
    PLAN_REMINDER_LABELS.eveningBefore;

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      {/* Event chip */}
      {scenario.title && (
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
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: C.ink3 }}>
              активность
            </span>
            <span style={{ fontSize: 14, color: C.ink, fontWeight: 600, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {scenario.title}
            </span>
          </span>
        </div>
      )}

      <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-sans)", fontSize: 38, lineHeight: 1, letterSpacing: "-.02em", fontWeight: 600 }}>
        Куда сохранить{" "}
        <span style={{ fontStyle: "italic", color: C.accentDeep }}>активность</span>?
      </h2>
      <p style={{ marginTop: 8, marginBottom: 22, fontSize: 14, color: C.ink3, lineHeight: 1.5 }}>
        Положите в план на дату — {reminderHint}.
        {" "}Или сохраните в идеи, чтобы вернуться позже.
      </p>

      <KickerLine label="в план" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isSingleDate ? (
          <>
            <OptRow num="01" iconEl={<IcoCircle bg={C.ink} color="#FAF7F1"><CalIcon size={17} color="#FAF7F1" /></IcoCircle>}
              title="На дату проведения" sub={fmtDateLong(eventPlanDateISO ?? "")}
              onClick={() => onPlan(eventPlanDateISO ?? "")} />
            <OptRow num="02" iconEl={<IcoCircle bg={C.bg} color={C.ink2} border={`1px solid ${C.line2}`}><CalIcon size={17} /></IcoCircle>}
              title="Выбрать другую дату" sub="Открыть календарь"
              onClick={onSwitchCalendar} />
          </>
        ) : isLongRunning ? (
          <OptRow num="01" iconEl={<IcoCircle bg={C.ink} color="#FAF7F1"><CalIcon size={17} color="#FAF7F1" /></IcoCircle>}
            title="Выбрать дату" sub={rangeLabel ?? "Выбрать дату посещения"}
            onClick={onSwitchCalendar} />
        ) : upcomingOptions.length > 0 ? (
          <>
            {upcomingOptions.slice(0, 2).map((iso, i) => (
              <OptRow key={iso} num={`0${i + 1}`}
                iconEl={<IcoCircle bg={i === 0 ? C.ink : C.bg} color={i === 0 ? "#FAF7F1" : C.ink2} border={i === 0 ? undefined : `1px solid ${C.line2}`}><CalIcon size={17} color={i === 0 ? "#FAF7F1" : undefined} /></IcoCircle>}
                title={i === 0 ? "Ближайшая дата" : "Следующая дата"} sub={fmtDateLong(iso)}
                onClick={() => onPlan(iso)} />
            ))}
            {upcomingOptions.length > 2 && (
              <OptRow num={`0${Math.min(upcomingOptions.length, 3)}`}
                iconEl={<IcoCircle bg={C.bg} color={C.ink2} border={`1px solid ${C.line2}`}><CalIcon size={17} /></IcoCircle>}
                title="Выбрать дату" sub={`Ещё ${upcomingOptions.length - 2} дат в расписании`}
                onClick={onSwitchCalendar} />
            )}
          </>
        ) : (
          <>
            <OptRow num="01" iconEl={<IcoCircle bg={C.ink} color="#FAF7F1"><CalIcon size={17} color="#FAF7F1" /></IcoCircle>}
              title="Сегодня" sub={`В план на ${formatLocalPlanDate(todayISO, "ru-RU")}`}
              onClick={() => onPlan(todayISO)} />
            <OptRow num="02" iconEl={<IcoCircle bg={C.bg} color={C.ink2} border={`1px solid ${C.line2}`}><CalIcon size={17} /></IcoCircle>}
              title="Завтра" sub={`В план на ${formatLocalPlanDate(tomorrowISO, "ru-RU")}`}
              onClick={() => onPlan(tomorrowISO)} />
            <OptRow num="03" iconEl={<IcoCircle bg={C.bg} color={C.ink2} border={`1px solid ${C.line2}`}><CalIcon size={17} /></IcoCircle>}
              title="Выбрать дату" sub="Открыть календарь и выбрать день"
              onClick={onSwitchCalendar} />
          </>
        )}
      </div>

      <OrDivider />
      <KickerLine label="без даты" />
      <IdeasRow onClick={onIdea} />
    </div>
  );
}

// ─── Confirm / timeslots scenario ─────────────────────────────────────────────
function ConfirmView({ scenario, isIdea, inPlan, planDate, onCommit }: {
  scenario: Extract<SaveScenario, { kind: "confirm" | "timeslots" }>;
  isIdea: boolean; inPlan: boolean; planDate: string | null;
  onCommit: (r: SaveToPlanResult) => void;
}) {
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(
    scenario.kind === "timeslots" && scenario.slots.length > 0 ? scenario.slots[0].id : null,
  );
  const handlePlan = () => {
    if (scenario.kind === "confirm") {
      onCommit({ action: "plan", dateISO: scenario.dateISO, timeSlotId: scenario.slotId ?? null });
    } else {
      onCommit({ action: "plan", dateISO: scenario.dateISO, timeSlotId: selectedSlotId });
    }
  };

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      <h2 style={{ margin: "0 0 20px", fontFamily: "var(--font-sans)", fontSize: 34, lineHeight: 1, letterSpacing: "-.02em", fontWeight: 600 }}>
        {scenario.kind === "timeslots"
          ? <>Выберите <span style={{ fontStyle: "italic", color: C.accentDeep }}>время</span></>
          : <>Добавить в <span style={{ fontStyle: "italic", color: C.accentDeep }}>план</span>?</>}
      </h2>
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", color: C.ink }}>{scenario.title}</div>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 3 }}>
          {scenario.dateLabel}{scenario.kind === "confirm" ? ` · ${scenario.timeLabel}` : ""}
        </div>
      </div>
      {scenario.kind === "timeslots" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {scenario.slots.map((slot) => {
            const isSel = selectedSlotId === slot.id;
            return (
              <button key={slot.id} onClick={() => setSelectedSlotId(slot.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                borderRadius: 16, border: `2px solid ${isSel ? C.ink : C.line}`,
                background: isSel ? C.ink : C.paper, color: isSel ? "#FAF7F1" : C.ink,
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
                cursor: "pointer", transition: "all .15s", textAlign: "left",
              }}>
                <span style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${isSel ? "#FAF7F1" : C.line2}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSel && <span style={{ width: 8, height: 8, borderRadius: 99, background: "#FAF7F1" }} />}
                </span>
                {slot.label}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <button onClick={() => onCommit({ action: "ideas" })} style={{
          flex: 1, height: 46, borderRadius: 999, border: `1px solid ${C.line2}`,
          background: "transparent", color: C.ink, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontFamily: "var(--font-sans)",
        }}>
          {isIdea ? "Уже в идеях" : "В идеи"}
        </button>
        <button onClick={handlePlan} disabled={!!inPlan} style={{
          flex: 1.2, height: 46, borderRadius: 999,
          background: inPlan ? C.line : C.ink, color: inPlan ? C.ink3 : "#FAF7F1",
          border: 0, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          cursor: inPlan ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)",
        }}>
          {inPlan && planDate ? `На ${formatLocalPlanDate(planDate, "ru-RU")}` : "Добавить в план"}
          {!inPlan && <ArrowIcon size={14} color="#FAF7F1" />}
        </button>
      </div>
    </div>
  );
}

// ─── Idea-only view (no date semantics — e.g. Article) ───────────────────────
function IdeaOnlyView({ title, isIdea, onIdea, onRemoveIdea }: {
  title: string; isIdea: boolean; onIdea: () => void; onRemoveIdea: () => void;
}) {
  if (isIdea) {
    return (
      <div style={{ padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 99, background: C.green, color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, boxShadow: `0 0 0 4px ${C.greenBg}`,
          }}>✓</span>
          <span style={{ fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const, fontSize: 10, letterSpacing: ".14em", color: C.green }}>уже в идеях</span>
        </div>

        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-sans)", fontSize: 30, lineHeight: 1.02, letterSpacing: "-.02em", fontWeight: 400 }}>
          Сохранено в идеях
        </h2>

        <p style={{ marginTop: 8, marginBottom: 18, fontSize: 13, color: C.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {title}
        </p>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 14px 14px 16px",
          background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 18,
        }}>
          <IcoCircle bg={C.accentSoft} color={C.accentDeep}><BookmarkIcon size={16} /></IcoCircle>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.005em", color: C.ink }}>Без даты</div>
            <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: C.ink3, marginTop: 3, letterSpacing: ".04em" }}>● в идеях</div>
          </div>
          <button onClick={onRemoveIdea} title="Убрать из идей" style={{
            width: 32, height: 32, borderRadius: 99, border: `1px solid ${C.line2}`,
            background: "transparent", color: C.ink3,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}><TrashIcon size={13} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <button onClick={() => { window.location.href = "/me/ideas"; }} style={{
            flex: 1, height: 46, borderRadius: 999, background: C.ink, color: "#FAF7F1",
            border: 0, fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            cursor: "pointer", fontFamily: "var(--font-sans)",
          }}>
            Все мои идеи <ExternalLinkIcon size={13} color="#FAF7F1" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 24px 20px" }}>
      <span style={{
        fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase" as const,
        fontSize: 10, letterSpacing: ".14em", color: C.accentDeep,
        display: "inline-block", marginBottom: 12,
      }}>● сохранить статью</span>

      <h2 style={{
        margin: "0 0 8px",
        fontFamily: "var(--font-sans)",
        fontSize: 30, lineHeight: 1.02, letterSpacing: "-.02em", fontWeight: 600,
      }}>
        Оставь{" "}
        <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 500, color: "var(--primary)" }}>
          на потом
        </span>
      </h2>

      <p style={{
        marginTop: 8, marginBottom: 22, fontSize: 13, color: C.ink3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
      }}>
        {title}
      </p>

      <IdeasRow onClick={onIdea} title="Добавить в идеи" subtitle="Вернуться к этой статье позже" />
    </div>
  );
}

// ─── SaveToPlanPickerBody ─────────────────────────────────────────────────────
export function SaveToPlanPickerBody({
  scenario, onCommit, isIdea = false, inPlan = false,
  planDate = null, planStartsAt = null, planItemId = null,
  source, onClose,
}: SaveToPlanPickerBodyProps) {
  const [view, setView] = React.useState<"main" | "calendar">("main");
  const [replanMode, setReplanMode] = React.useState(false);

  const todayISO = getLocalDateKey();
  const isQuickdate = scenario.kind === "quickdate";
  const isIdeaOnly = isQuickdate && scenario.ideaOnly === true;

  const eventPlanDateOptions = React.useMemo(() => {
    if (scenario.kind !== "quickdate") return [];
    if ((scenario.eventPlanDateOptions?.length ?? 0) > 0) return scenario.eventPlanDateOptions ?? [];
    return buildDateRangeKeys(scenario.eventPlanDateISO, scenario.eventPlanDateEndISO);
  }, [scenario]);

  const normalizedOptions = React.useMemo(() => {
    const unique = new Set(eventPlanDateOptions.map((d) => normalizePlanDateISO(d)).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [eventPlanDateOptions]);
  const sessionsByDate = React.useMemo(() => {
    if (scenario.kind !== "quickdate") return undefined;
    return scenario.eventPlanSessionsByDate;
  }, [scenario]);

  const upcomingOptions = normalizedOptions.filter((d) => d >= todayISO);

  if (!isQuickdate) {
    return (
      <ConfirmView
        scenario={scenario as Extract<SaveScenario, { kind: "confirm" | "timeslots" }>}
        isIdea={isIdea} inPlan={inPlan} planDate={planDate}
        onCommit={onCommit}
      />
    );
  }

  // Idea-only entity (e.g. Article): never render calendar/date-slider UI,
  // regardless of any legacy inPlan/planDate state.
  if (isIdeaOnly) {
    return (
      <IdeaOnlyView
        title={scenario.title}
        isIdea={isIdea}
        onIdea={() => onCommit({ action: "ideas" })}
        onRemoveIdea={() => onCommit({ action: "remove-idea" })}
      />
    );
  }

  if (view === "calendar") {
    return (
      <CalendarView
        onSelect={(iso) => { setView("main"); onCommit({ action: "plan", dateISO: iso, timeSlotId: null }); }}
        allowedDateKeys={upcomingOptions.length > 0 ? upcomingOptions : null}
        onBack={() => setView("main")}
      />
    );
  }

  // Already in plan — manage state (unless user clicked "change date")
  if (inPlan && planDate && !replanMode) {
    return (
      <InPlanView
        planDate={planDate}
        planStartsAt={planStartsAt}
        planItemId={planItemId}
        onSwitchCalendar={() => setReplanMode(true)}
        onRemovePlan={(id) => onCommit({ action: "remove-plan", planItemId: id })}
        onClose={() => { onClose?.(); }}
      />
    );
  }

  // Already in ideas — nudge to plan
  if (isIdea) {
    return (
      <InIdeasView
        onRemoveIdea={() => onCommit({ action: "remove-idea" })}
        onSchedule={(iso) => onCommit({ action: "plan", dateISO: iso, timeSlotId: null })}
        dateOptions={upcomingOptions}
      />
    );
  }

  // For quickdate — always use the date slider UI.
  // If no event dates available, fall back to today + next 6 days.
  const sliderOptions = upcomingOptions.length > 0
    ? upcomingOptions
    : Array.from({ length: 7 }, (_, i) => addDaysLocal(todayISO, i));

  return (
    <div style={{ position: "relative" }}>
      {replanMode && (
        <button onClick={() => setReplanMode(false)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, margin: "24px 24px 0",
          fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".12em",
          textTransform: "uppercase" as const, color: C.ink3, background: "none", border: 0, cursor: "pointer", padding: 0,
        }}>‹ Назад</button>
      )}
      <DateSliderView
        options={sliderOptions}
        title={scenario.title}
        sessionsByDate={sessionsByDate}
        onConfirm={(iso, sessionId) => onCommit({ action: "plan", dateISO: iso, timeSlotId: sessionId ?? null })}
        onIdea={() => onCommit({ action: "ideas" })}
      />
    </div>
  );
}

// ─── Modal wrappers ───────────────────────────────────────────────────────────
interface ModalContentProps extends SaveToPlanModalProps { onClose: () => void; }

function ModalContent(props: ModalContentProps) {
  const { onConfirm, onClose, scenario, isIdea, inPlan, planDate, planStartsAt, source } = props;
  return (
    <>
      <style>{`
        .stp-opt:hover:not(:disabled) { background: #fff !important; border-color: #141210 !important; transform: translateX(2px); }
        .stp-opt:hover:not(:disabled) .stp-arr { transform: translateX(4px); color: #C24E22 !important; }
      `}</style>
      <div style={{ position: "relative" }}>
        <SaveToPlanPickerBody
          scenario={scenario}
          isIdea={isIdea}
          inPlan={inPlan}
          planDate={planDate}
          planStartsAt={planStartsAt}
          source={source}
          onCommit={(result) => {
            if (result.action === "plan") toastPlan(result.dateISO);
            else if (result.action === "ideas") toastIdea();
            else if (result.action === "remove-idea") toastRemovedIdea();
            onConfirm(result);
            onClose();
          }}
        />
      </div>
    </>
  );
}

export function SaveToPlanModal(props: SaveToPlanModalProps) {
  const { open, onOpenChange } = props;
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200"
          style={{ background: C.bg }}
        >
          <DialogTitle className="sr-only">Сохранить активность</DialogTitle>
          <ModalContent {...props} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="fixed inset-x-0 bottom-0 w-full max-h-[90vh] rounded-t-3xl border-t shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
        style={{ background: C.bg, borderTopColor: C.line }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: C.line2 }} />
        </div>
        <SheetTitle className="sr-only">Сохранить активность</SheetTitle>
        <div className="flex-1 overflow-y-auto">
          <ModalContent {...props} onClose={() => onOpenChange(false)} />
        </div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}

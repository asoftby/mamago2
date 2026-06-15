"use client";

import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";
import { useEffect, useMemo, useState } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import {
  calculateBookingInterval,
  defaultSchedule,
  detectConflicts,
  getVenueBookingDurationOptions,
  scheduleChipLabel,
  TIME_OPTIONS,
  type ScenarioItemSchedule,
} from "../../lib/scheduleUtils";

const MONTHS_RU = [
  "янв","фев","мар","апр","май","июн",
  "июл","авг","сен","окт","ноя","дек",
];

function fmtShort(key: string | null): string {
  if (!key) return "—";
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_RU[(m ?? 1) - 1]}`;
}

const PARTY_START_TIMES = ["11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const TAG_LABEL: Record<string, string> = {
  площадка: "Площадка",
  аниматор: "Аниматор",
  торт:     "Торт",
  еда:      "Еда и напитки",
  декор:    "Декор",
};

const MODE_HINT: Record<string, string> = {
  VENUE_SLOT:      "интервал бронирования",
  EXACT_TIME:      "точное время выступления",
  DELIVERY_BEFORE: "доставить до",
  SETUP_RANGE:     "монтаж",
  NO_TIME:         "",
};

function ArrowIcon({ c = "currentColor" }: { c?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ScenarioTimeRow({
  label,
  description,
  onChange,
}: {
  label: string;
  description: string | null;
  onChange: () => void;
}) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
      {description ? (
        <span style={{ color: "rgba(20,18,16,.45)", fontSize: 11 }}>
          {description}
        </span>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 10px",
            borderRadius: 99,
            background: "#FAF7F1",
            color: "#3A332B",
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          <ClockIcon />
          {label}
        </span>
        <button
          type="button"
          onClick={onChange}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            color: "rgba(20,18,16,.40)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          изменить
        </button>
      </div>
    </div>
  );
}

interface SummaryItem {
  id: string;
  title: string;
  tag: string;
  price: number;
}

interface Props {
  builder: BirthdayBuilderWithGate;
  totalPrice: number;
  summaryItems: SummaryItem[];
  onSubmitScenario?: () => void;
}

// ─── Time editor for one item ─────────────────────────────────────────────────

function TimeEditor({
  schedule,
  onChange,
}: {
  schedule: ScenarioItemSchedule;
  onChange: (s: ScenarioItemSchedule) => void;
}) {
  const selectStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid rgba(20,18,16,.18)",
    background: "#fff",
    fontFamily: "var(--font-mono, ui-monospace)",
    fontSize: 13,
    color: "#141210",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    paddingRight: 28,
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M0 0l5 6 5-6z' fill='%23141210' opacity='.4'/></svg>")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, ui-monospace)",
    fontSize: 10,
    letterSpacing: ".1em",
    textTransform: "uppercase",
    color: "rgba(20,18,16,.45)",
    marginBottom: 4,
  };

  if (schedule.timeMode === "DELIVERY_BEFORE") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={labelStyle}>Доставить до</div>
        <select
          style={selectStyle}
          value={schedule.deliveryBeforeAt ?? ""}
          onChange={(e) => onChange({ ...schedule, deliveryBeforeAt: e.target.value, isManuallySet: true })}
        >
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    );
  }

  if (schedule.timeMode === "NO_TIME") {
    return <div style={{ fontSize: 13, color: "rgba(20,18,16,.45)" }}>Время не требуется</div>;
  }

  const startLabel = schedule.timeMode === "SETUP_RANGE" ? "Начало монтажа" : "Начало";
  const endLabel   = schedule.timeMode === "SETUP_RANGE" ? "Конец монтажа"  : "Конец";

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={labelStyle}>{startLabel}</div>
        <select
          style={selectStyle}
          value={schedule.startAt ?? ""}
          onChange={(e) => onChange({ ...schedule, startAt: e.target.value, isManuallySet: true })}
        >
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={labelStyle}>{endLabel}</div>
        <select
          style={selectStyle}
          value={schedule.endAt ?? ""}
          onChange={(e) => onChange({ ...schedule, endAt: e.target.value, isManuallySet: true })}
        >
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Single scenario row ──────────────────────────────────────────────────────

function ScenarioRow({
  item,
  schedule,
  conflict,
  expanded,
  isVenue,
  bookingDurationOptions,
  selectedVenueBookingDurationHours,
  onToggleExpand,
  onChangeVenueBookingDuration,
  onChangeSchedule,
}: {
  item: SummaryItem;
  schedule: ScenarioItemSchedule | null;
  conflict: string | null;
  expanded: boolean;
  isVenue: boolean;
  bookingDurationOptions: number[];
  selectedVenueBookingDurationHours: number;
  onToggleExpand: () => void;
  onChangeVenueBookingDuration: (durationHours: number) => void;
  onChangeSchedule: (s: ScenarioItemSchedule) => void;
}) {
  const chipLabel = schedule ? scheduleChipLabel(schedule) : null;
  const modeHint  = schedule ? MODE_HINT[schedule.timeMode] : null;
  const showVenueBookingOptions = isVenue && schedule != null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: `1px solid ${conflict ? "rgba(232,106,58,.35)" : "rgba(20,18,16,.08)"}`,
        overflow: "hidden",
        transition: "border-color .15s",
      }}
    >
      {/* Main row */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Left: tag + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "#C24E22",
            marginBottom: 3,
          }}>
            {TAG_LABEL[item.tag] ?? item.tag}
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#141210",
            letterSpacing: "-.005em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {item.title}
          </div>

          {/* Time chip + mode hint */}
          {chipLabel && (
            <ScenarioTimeRow
              label={chipLabel}
              description={modeHint}
              onChange={onToggleExpand}
            />
          )}
        </div>

        {/* Right: price */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: "#141210",
          }}>
            {item.price}
          </span>
          <span style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 10,
            color: "rgba(20,18,16,.45)",
            marginLeft: 3,
          }}>
              <BelarusianRubleIcon />
          </span>
        </div>
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div style={{
          margin: "0 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 10px",
          borderRadius: 8,
          background: "rgba(232,106,58,.08)",
          color: "#C24E22",
          fontSize: 12,
        }}>
          <WarnIcon />
          {conflict}
        </div>
      )}

      {showVenueBookingOptions && (
        <div
          style={{
            borderTop: "1px solid rgba(20,18,16,.07)",
            padding: "14px 16px",
            background: expanded ? "#FFF3EC" : "#FDFAF6",
            transition: "background .12s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-mono, ui-monospace)",
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "rgba(20,18,16,.45)",
              }}
            >
              Доступные интервалы брони площадки
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {bookingDurationOptions.map((durationHours) => (
                <button
                  key={durationHours}
                  type="button"
                  onClick={() => onChangeVenueBookingDuration(durationHours)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 99,
                    border: `1px solid ${
                      selectedVenueBookingDurationHours === durationHours
                        ? "transparent"
                        : "rgba(20,18,16,.10)"
                    }`,
                    background:
                      selectedVenueBookingDurationHours === durationHours
                        ? "#E86A3A"
                        : "#fff",
                    color:
                      selectedVenueBookingDurationHours === durationHours
                        ? "#fff"
                        : "#3A332B",
                    fontFamily: "var(--font-mono, ui-monospace)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {durationHours}{" "}
                  {durationHours === 1
                    ? "час"
                    : durationHours < 5
                      ? "часа"
                      : "часов"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expanded time editor */}
      {expanded && schedule && (
        <div style={{
          borderTop: "1px solid rgba(20,18,16,.07)",
          padding: "14px 16px",
          background: "#FDFAF6",
        }}>
          <TimeEditor schedule={schedule} onChange={onChangeSchedule} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepDone({
  builder,
  totalPrice,
  summaryItems,
  onSubmitScenario,
}: Props) {
  const {
    state,
    setPartyPlanning,
    setItemSchedule,
    setItemSchedules,
    selectedBase,
  } = builder;
  const { dateRangeFrom, dateRangeTo, guestsGroup, partyForChild } = state.quiz;
  const {
    timeStart,
    itemSchedules = {},
    selectedVenueBookingDurationHours = 3,
  } = state.partyPlanning;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selectedTime = timeStart ?? "15:00";
  const venueBookingDurationOptions = useMemo(
    () => getVenueBookingDurationOptions(selectedBase),
    [selectedBase],
  );

  // ── Init schedules for newly-added items ────────────────────────────────────
  useEffect(() => {
    let changed = false;
    const next = { ...itemSchedules };
    for (const item of summaryItems) {
      if (!next[item.id]) {
        next[item.id] = defaultSchedule(item.tag, selectedTime, {
          venueDurationHours: selectedVenueBookingDurationHours,
        });
        changed = true;
      }
    }
    if (changed) setItemSchedules(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryItems.map((i) => i.id).join(","), selectedTime, selectedVenueBookingDurationHours]);

  // ── Global time preset change ───────────────────────────────────────────────
  const handleGlobalTime = (t: string) => {
    setPartyPlanning({ timeStart: t });
    const next: Record<string, ScenarioItemSchedule> = {};
    for (const item of summaryItems) {
      const existing = itemSchedules[item.id];
      next[item.id] =
        item.tag === "площадка"
          ? defaultSchedule(item.tag, t, {
              venueDurationHours: selectedVenueBookingDurationHours,
            })
          : existing?.isManuallySet
            ? existing
            : defaultSchedule(item.tag, t);
    }
    setItemSchedules(next);
  };

  const handleVenueBookingDurationChange = (
    itemId: string,
    durationHours: number,
  ) => {
    const interval = calculateBookingInterval(selectedTime, durationHours);
    setPartyPlanning({ selectedVenueBookingDurationHours: durationHours });
    setItemSchedule(itemId, {
      timeMode: "VENUE_SLOT",
      startAt: interval.startsAt,
      endAt: interval.endsAt,
      deliveryBeforeAt: null,
      isManuallySet: false,
    });
  };

  // ── Conflicts ───────────────────────────────────────────────────────────────
  const conflicts = useMemo(
    () => detectConflicts(summaryItems.map((i) => ({ id: i.id, tag: i.tag })), itemSchedules),
    [summaryItems, itemSchedules],
  );
  const conflictMap = useMemo(
    () => Object.fromEntries(conflicts.map((c) => [c.itemId, c.message])),
    [conflicts],
  );

  const guestsLabel: Record<string, string> = {
    up5: "до 5", "5-10": "5–10", "10-15": "10–15", "15plus": "15+",
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <span style={{
        fontFamily: "var(--font-mono, ui-monospace)",
        fontSize: 11,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "#C24E22",
      }}>
        ● Шаг 5 · готово
      </span>

      <h2 style={{
        fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
        fontWeight: 700,
        margin: "14px 0 0",
        fontSize: 50,
        fontStyle: "normal",
        lineHeight: 0.98,
        letterSpacing: "-.025em",
        color: "#141210",
      }}>
        Праздник{" "}
        <span style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "#E86A3A" }}>собран</span>{" "}
        🎉
      </h2>

      <p style={{ marginTop: 14, fontSize: 16, color: "#3A332B" }}>
        Проверьте сценарий и уточните время для каждого исполнителя.
      </p>

      {/* ── Scenario card ── */}
      <div style={{
        marginTop: 24,
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
        padding: "20px 22px",
      }}>
        <div style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "rgba(20,18,16,.55)",
          marginBottom: 14,
        }}>
          Сценарий
        </div>

        {/* Tags row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {partyForChild && (
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 12, padding: "5px 11px", background: "#fff", borderRadius: 99 }}>
              {partyForChild.name} · {partyForChild.ageLabel}
            </span>
          )}
          {guestsGroup && (
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 12, padding: "5px 11px", background: "#fff", borderRadius: 99 }}>
              {guestsLabel[guestsGroup] ?? guestsGroup} детей
            </span>
          )}
          <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 12, padding: "5px 11px", background: "#fff", borderRadius: 99 }}>
            {fmtShort(dateRangeFrom)}{dateRangeTo && dateRangeTo !== dateRangeFrom ? ` — ${fmtShort(dateRangeTo)}` : ""}
          </span>
        </div>

        {/* ── Global time preset ── */}
        <div style={{
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: "1px solid rgba(20,18,16,.08)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(20,18,16,.45)",
            marginBottom: 10,
          }}>
            Время начала праздника
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PARTY_START_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleGlobalTime(t)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 99,
                  background: selectedTime === t ? "#E86A3A" : "#fff",
                  color: selectedTime === t ? "#fff" : "#3A332B",
                  border: `1px solid ${selectedTime === t ? "transparent" : "rgba(20,18,16,.10)"}`,
                  fontFamily: "var(--font-mono, ui-monospace)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all .12s",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        {summaryItems.length === 0 ? (
          <div style={{ fontSize: 14, color: "rgba(20,18,16,.55)" }}>
            Пока ничего не выбрано — вернитесь к подбору.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summaryItems.map((item) => (
              <ScenarioRow
                key={item.id}
                item={item}
                schedule={itemSchedules[item.id] ?? null}
                conflict={conflictMap[item.id] ?? null}
                isVenue={item.tag === "площадка"}
                bookingDurationOptions={venueBookingDurationOptions}
                selectedVenueBookingDurationHours={
                  selectedVenueBookingDurationHours
                }
                expanded={expandedId === item.id}
                onToggleExpand={() => setExpandedId((prev) => prev === item.id ? null : item.id)}
                onChangeVenueBookingDuration={(durationHours) =>
                  handleVenueBookingDurationChange(item.id, durationHours)
                }
                onChangeSchedule={(s) => {
                  setItemSchedule(item.id, s);
                  setExpandedId(null);
                }}
              />
            ))}
          </div>
        )}

        {/* Total */}
        {summaryItems.length > 0 && (
          <div style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid rgba(20,18,16,.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(20,18,16,.45)" }}>
              Итого
            </span>
            <span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#141210" }}>
                {totalPrice}
              </span>
              <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: "rgba(20,18,16,.45)", marginLeft: 4 }}>
              <BelarusianRubleIcon />
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          disabled={summaryItems.length === 0}
          onClick={() => {
            if (summaryItems.length === 0) return;
            if (!builder.isAuthenticated) {
              builder.requestLoginToSubmit();
              return;
            }
            onSubmitScenario?.();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            height: 60,
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 999,
            border: 0,
            cursor: summaryItems.length === 0 ? "default" : "pointer",
            background: summaryItems.length === 0 ? "rgba(20,18,16,.18)" : "#E86A3A",
            color: "#fff",
            transition: "background .2s",
          }}
        >
          {summaryItems.length > 0
            ? <>Отправить {summaryItems.length} заявк{summaryItems.length === 1 ? "у" : summaryItems.length <= 4 ? "и" : ""} организаторам <ArrowIcon c="#fff" /></>
            : "Выберите исполнителей на шаге 4"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            type="button"
            onClick={() => builder.resetBuilder()}
            style={{
              fontSize: 13,
              color: "rgba(20,18,16,.55)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              background: "none",
              border: 0,
              cursor: "pointer",
            }}
          >
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
}

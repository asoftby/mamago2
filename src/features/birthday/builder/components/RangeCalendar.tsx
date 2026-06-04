"use client";

import { useState } from "react";

const MONTHS_RU = [
  "январь","февраль","март","апрель","май","июнь",
  "июль","август","сентябрь","октябрь","ноябрь","декабрь",
];
const DOW_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

interface DateRange {
  from: string | null;
  to: string | null;
}

interface RangeCalendarProps {
  range: DateRange;
  setRange: (r: DateRange) => void;
}

function toMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m, d).getTime();
}

export function RangeCalendar({ range, setRange }: RangeCalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mon=0
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);

  const key = (d: number) => `${view.y}-${view.m}-${d}`;

  const onPick = (d: number) => {
    const k = key(d);
    if (!range.from || (range.from && range.to)) {
      setRange({ from: k, to: null });
    } else {
      if (toMs(k) < toMs(range.from)) setRange({ from: k, to: range.from });
      else setRange({ from: range.from, to: k });
    }
  };

  const inRange = (d: number) => {
    if (!range.from) return false;
    const t = toMs(key(d));
    const a = toMs(range.from);
    const b = range.to ? toMs(range.to) : a;
    return t > Math.min(a, b) && t < Math.max(a, b);
  };

  const isEnd = (d: number) => range.from === key(d) || range.to === key(d);
  const isToday = (d: number) =>
    view.y === now.getFullYear() && view.m === now.getMonth() && d === now.getDate();

  const prevMonth = () =>
    setView((v) => ({
      y: v.m === 0 ? v.y - 1 : v.y,
      m: v.m === 0 ? 11 : v.m - 1,
    }));
  const nextMonth = () =>
    setView((v) => ({
      y: v.m === 11 ? v.y + 1 : v.y,
      m: v.m === 11 ? 0 : v.m + 1,
    }));

  const navBtnStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 99,
    border: "1px solid rgba(20,18,16,.18)",
    color: "#3A332B",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    background: "transparent",
    transition: "all .15s",
  };

  return (
    <div
      style={{
        background: "#FAF7F1",
        border: "1px solid rgba(20,18,16,.10)",
        borderRadius: 18,
        padding: "24px 26px 28px",
      }}
    >
      {/* Month nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
          style={navBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#141210";
            (e.currentTarget as HTMLButtonElement).style.color = "#FAF7F1";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#141210";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#3A332B";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.18)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <span
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontSize: 24,
            letterSpacing: "-.01em",
            textTransform: "capitalize",
            color: "#141210",
          }}
        >
          {MONTHS_RU[view.m]}{" "}
          <span style={{ color: "rgba(20,18,16,.55)" }}>{view.y}</span>
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Следующий месяц"
          style={navBtnStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#141210";
            (e.currentTarget as HTMLButtonElement).style.color = "#FAF7F1";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#141210";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#3A332B";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.18)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
        }}
      >
        {DOW_RU.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              color: "rgba(20,18,16,.55)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              paddingBottom: 8,
            }}
          >
            {d}
          </div>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const end = isEnd(d);
          const mid = inRange(d);
          const today = isToday(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              style={{
                aspectRatio: "1/1",
                borderRadius: end ? 14 : 10,
                border: today && !end ? "1.5px solid #E86A3A" : "1px solid transparent",
                background: end ? "#141210" : mid ? "#FFE8DC" : "transparent",
                color: end ? "#FAF7F1" : "#141210",
                fontFamily: "var(--font-mono, ui-monospace)",
                fontSize: 16,
                cursor: "pointer",
                transition: "all .12s",
              }}
              onMouseEnter={(e) => {
                if (!end && !mid)
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,18,16,.05)";
              }}
              onMouseLeave={(e) => {
                if (!end && !mid)
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { RangeCalendar } from "../RangeCalendar";

const MONTHS_RU = [
  "январь","февраль","март","апрель","май","июнь",
  "июль","август","сентябрь","октябрь","ноябрь","декабрь",
];

function fmtShort(key: string | null): string | null {
  if (!key) return null;
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_RU[m]?.slice(0, 3)}`;
}

interface Props {
  builder: BirthdayBuilderWithGate;
}

export function StepWhen({ builder }: Props) {
  const { state, setBasics } = builder;
  const from = state.quiz.dateRangeFrom;
  const to = state.quiz.dateRangeTo;

  const range = { from, to };
  const setRange = (r: { from: string | null; to: string | null }) => {
    setBasics({ dateRangeFrom: r.from, dateRangeTo: r.to });
  };

  const now = new Date();
  const nearestSat = new Date(now);
  nearestSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  const nearestSun = new Date(nearestSat);
  nearestSun.setDate(nearestSat.getDate() + 1);
  const wkFrom = `${nearestSat.getFullYear()}-${nearestSat.getMonth()}-${nearestSat.getDate()}`;
  const wkTo = `${nearestSun.getFullYear()}-${nearestSun.getMonth()}-${nearestSun.getDate()}`;

  const isWeekendQuick = from === wkFrom && to === wkTo;

  return (
    <div>
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#C24E22",
        }}
      >
        ● Шаг 1 · сначала дата
      </span>

      <h1
        style={{
          fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
          fontWeight: 700,
          margin: "14px 0 0",
          fontSize: 50,
          fontStyle: "normal",
          lineHeight: 0.98,
          letterSpacing: "-.025em",
          color: "#141210",
        }}
      >
        Когда{" "}
        <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "#E86A3A" }}>планируете</span>
        <br />
        праздник?
      </h1>

      <p
        style={{
          maxWidth: 520,
          marginTop: 16,
          fontSize: 17,
          lineHeight: 1.5,
          color: "#3A332B",
        }}
      >
        Выберите удобный диапазон дат — под него мы покажем только свободных
        исполнителей и площадки.
      </p>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 560 }}>
        {/* Hint */}
        <div
          style={{
            padding: "16px 18px",
            background: "#FFE8DC",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#C24E22",
              marginBottom: 6,
            }}
          >
            ● как выбрать
          </div>
          {from && !to ? (
            <div style={{ fontSize: 14, color: "#C24E22" }}>
              Теперь выберите дату окончания диапазона
            </div>
          ) : from && to ? (
            <div style={{ fontSize: 14, color: "#3A332B" }}>
              Выбрано: {fmtShort(from)} — {fmtShort(to)}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#3A332B" }}>
              Кликните дату начала, затем дату окончания.
            </div>
          )}
        </div>

        {/* Quick pick */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(20,18,16,.55)",
              marginBottom: 10,
            }}
          >
            Быстрый выбор
          </div>
          <button
            type="button"
            onClick={() => setRange({ from: wkFrom, to: wkTo })}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 99,
              background: isWeekendQuick ? "#141210" : "#FAF7F1",
              color: isWeekendQuick ? "#FAF7F1" : "#141210",
              border: `1px solid ${isWeekendQuick ? "#141210" : "rgba(20,18,16,.10)"}`,
              fontSize: 14,
              fontWeight: isWeekendQuick ? 600 : 500,
              cursor: "pointer",
              transition: "all .15s",
              whiteSpace: "nowrap",
            }}
          >
            Ближайшие выходные
          </button>
        </div>

        <RangeCalendar range={range} setRange={setRange} />
      </div>
    </div>
  );
}

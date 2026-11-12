"use client";

import type { ReactNode } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import type { PlaceType } from "../../types/builder";
import type { BirthdayBudgetGroup } from "../../../types/birthday";
import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";

const FORMATS: { key: PlaceType; icon: string; title: string; sub: string }[] = [
  { key: "HOME", icon: "🏠", title: "Дома", sub: "Уютно · услуги привезут к вам" },
  { key: "VENUE", icon: "🎪", title: "В заведении", sub: "Готовая площадка под ключ" },
  { key: "OUTDOOR", icon: "🌳", title: "На природе", sub: "Загородный формат" },
];

const BUDGETS: { key: BirthdayBudgetGroup; icon: string; title: ReactNode; sub: string }[] = [
  { key: "up300", icon: "💚", title: <span className="inline-flex items-center gap-[0.18em] whitespace-nowrap"><span>До 300</span><BelarusianRubleIcon size="text" /></span>, sub: "Рассмотрим варианты немного дороже" },
  { key: "300-600", icon: "💛", title: <span className="inline-flex items-center gap-[0.18em] whitespace-nowrap"><span>300–600</span><BelarusianRubleIcon size="text" /></span>, sub: "Допустим небольшое отклонение от бюджета" },
  { key: "600-1000", icon: "🧡", title: <span className="inline-flex items-center gap-[0.18em] whitespace-nowrap"><span>600–1000</span><BelarusianRubleIcon size="text" /></span>, sub: "Покажем варианты рядом с вашим бюджетом" },
  { key: "1000plus", icon: "💎", title: <span className="inline-flex items-center gap-[0.18em] whitespace-nowrap"><span>1000</span><span className="inline-flex items-center"><BelarusianRubleIcon size="text" /></span><span>и выше</span></span>, sub: "Бюджет без верхнего ограничения" },
];

function CheckIcon({ c = "#fff" }: { c?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function OptionRow({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: string;
  title: ReactNode;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 20px",
        minHeight: 82,
        borderRadius: 16,
        textAlign: "left",
        cursor: "pointer",
        background: "#FAF7F1",
        border: `1px solid ${selected ? "#141210" : "rgba(20,18,16,.10)"}`,
        transition: "all .15s",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", color: "#141210" }}>
          {title}
        </span>
        {sub && (
          <span style={{ display: "block", fontSize: 13, color: "rgba(20,18,16,.55)", marginTop: 2 }}>
            {sub}
          </span>
        )}
      </span>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          flexShrink: 0,
          border: `1.5px solid ${selected ? "#E86A3A" : "rgba(20,18,16,.18)"}`,
          background: selected ? "#E86A3A" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <CheckIcon />}
      </span>
    </button>
  );
}

interface Props {
  builder: BirthdayBuilderWithGate;
}

export function StepFormat({ builder }: Props) {
  const { state, setBasics, setPlaceType } = builder;
  const { placeType, budgetGroup } = state.quiz;

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
        ● Шаг 3 · формат и бюджет
      </span>

      <h2
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
        Где и за{" "}
        сколько?
      </h2>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Format */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(20,18,16,.55)",
              marginBottom: 12,
              minHeight: 56,
            }}
          >
            Формат праздника
            <p style={{ fontFamily: "var(--font-sans, ui-sans-serif, system-ui)", fontSize: 12, lineHeight: 1.4, letterSpacing: "normal", textTransform: "none", margin: "5px 0 0", color: "rgba(20,18,16,.55)" }}>
              Выберите удобное место для праздника. Остальное поможем организовать.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FORMATS.map((f) => (
              <OptionRow
                key={f.key}
                icon={f.icon}
                title={f.title}
                sub={f.sub}
                selected={placeType === f.key}
                onClick={() => setPlaceType(f.key)}
              />
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(20,18,16,.55)",
              marginBottom: 12,
              minHeight: 56,
            }}
          >
            Бюджет
            <p style={{ fontFamily: "var(--font-sans, ui-sans-serif, system-ui)", fontSize: 12, lineHeight: 1.4, letterSpacing: "normal", textTransform: "none", margin: "5px 0 0", color: "rgba(20,18,16,.55)" }}>
              Укажите примерный бюджет. Покажем подходящие варианты, даже если стоимость немного отличается.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {BUDGETS.map((b) => (
              <OptionRow
                key={b.key}
                icon={b.icon}
                title={b.title}
                sub={b.sub}
                selected={budgetGroup === b.key}
                onClick={() => setBasics({ budgetGroup: b.key })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

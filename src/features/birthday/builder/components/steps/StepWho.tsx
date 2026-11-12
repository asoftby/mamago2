"use client";

import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import type { BirthdayAgeSignalsState } from "../../hooks/useBirthdayAgeSignals";
import type { BirthdayGuestsGroup } from "../../../types/birthday";
import { PartyForChildSection } from "../PartyForChildSection";

const GUESTS_OPTIONS: { value: BirthdayGuestsGroup; label: string }[] = [
  { value: "up5", label: "до 5" },
  { value: "5-10", label: "5–10" },
  { value: "10-15", label: "10–15" },
  { value: "15plus", label: "15+" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 44,
        padding: "0 18px",
        borderRadius: 99,
        background: active ? "#141210" : "#FAF7F1",
        color: active ? "#FAF7F1" : "#141210",
        border: `1px solid ${active ? "#141210" : "rgba(20,18,16,.10)"}`,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        letterSpacing: "-.005em",
        cursor: "pointer",
        transition: "all .15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

interface Props {
  builder: BirthdayBuilderWithGate;
  ageSignals: BirthdayAgeSignalsState;
}

export function StepWho({ builder, ageSignals }: Props) {
  const { state, setBasics } = builder;
  const { guestsGroup } = state.quiz;

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
        ● Шаг 2 · для кого
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
        Кто{" "}
        
          именинник
        
        ?
      </h2>

      <p style={{ maxWidth: 480, marginTop: 14, fontSize: 16, color: "#3A332B" }}>
        Выберите человека и интересы — мы учтём их при подборе.
      </p>

      <div style={{ marginTop: 24, maxWidth: 560 }}>
        <PartyForChildSection builder={builder} ageSignals={ageSignals} />
      </div>

      <div style={{ marginTop: 28 }}>
        <div
          style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(20,18,16,.55)",
            marginBottom: 12,
          }}
        >
          Сколько гостей придёт
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GUESTS_OPTIONS.map((guestOption) => (
            <Chip
              key={guestOption.value}
              active={guestsGroup === guestOption.value}
              onClick={() => setBasics({ guestsGroup: guestOption.value })}
            >
              {guestOption.label} гостей
            </Chip>
          ))}
        </div>
      </div>

    </div>
  );
}

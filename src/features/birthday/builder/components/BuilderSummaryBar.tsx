"use client";

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import type { BirthdayBuilderState, BuilderStep } from "../types/builder";

const MONTHS_RU = [
  "январь","февраль","март","апрель","май","июнь",
  "июль","август","сентябрь","октябрь","ноябрь","декабрь",
];

function fmtDate(key: string | null): string | null {
  if (!key) return null;
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_RU[m]?.slice(0, 3)}`;
}

const GUESTS_LABELS: Record<string, string> = {
  up5: "до 5",
  "5-10": "5–10",
  "10-15": "10–15",
  "15plus": "15+",
};

const BUDGET_LABELS: Record<string, string> = {
  up300: "до 300",
  "300-600": "300–600",
  "600-1000": "600–1000",
  "1000plus": "1000+",
};

function ArrowRight({ c = "currentColor" }: { c?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ArrowLeft({ c = "currentColor" }: { c?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

interface Props {
  state: BirthdayBuilderState;
  totalPrice: number;
  overBudget: boolean;
  currentStep: BuilderStep;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  nextLabel: string;
  showDone?: boolean;
}

export function BuilderSummaryBar({
  state,
  totalPrice,
  overBudget,
  currentStep,
  onBack,
  onNext,
  canNext,
  nextLabel,
  showDone,
}: Props) {
  const { dateRangeFrom, dateRangeTo, partyForChild, guestsGroup, budgetGroup } = state.quiz;

  const showBack = currentStep !== "when";

  const dateText = dateRangeFrom
    ? `${fmtDate(dateRangeFrom)}${dateRangeTo ? ` — ${fmtDate(dateRangeTo)}` : ""}`
    : null;

  const parts: string[] = [];
  if (partyForChild) parts.push(`${partyForChild.name}`);
  if (guestsGroup) parts.push(`${GUESTS_LABELS[guestsGroup] ?? guestsGroup} детей`);
  if (budgetGroup) parts.push(BUDGET_LABELS[budgetGroup] ?? budgetGroup);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(20,18,16,.10)",
        boxShadow: "0 -10px 30px -10px rgba(20,18,16,.12)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 28px",
          minHeight: 64,
        }}
      >
        {/* Left: summary text */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "rgba(20,18,16,.55)",
            overflow: "hidden",
          }}
        >
          {dateText ? (
            <span style={{ color: "#C24E22", fontWeight: 500 }}>● {dateText}</span>
          ) : (
            <span style={{ color: "#C24E22", fontWeight: 500 }}>● выберите дату</span>
          )}

          {parts.map((p, i) => (
            <span key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{p}</span>
            </span>
          ))}

          {totalPrice > 0 && (
            <span style={{ display: "flex", gap: 8 }}>
              <span style={{ opacity: 0.4 }}>·</span>
              <span
                style={{
                  color: overBudget ? "#D6342B" : "#141210",
                  fontWeight: overBudget ? 700 : 500,
                }}
              >
                {totalPrice} {BYN_SYMBOL}{overBudget ? " ● превышен бюджет" : ""}
              </span>
              {!overBudget && (
                <span style={{ color: "#1F8A5B" }}>●</span>
              )}
            </span>
          )}
        </div>

        {/* Right: nav buttons */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 48,
                padding: "0 18px",
                borderRadius: 999,
                background: "transparent",
                color: "#141210",
                border: "1px solid rgba(20,18,16,.18)",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .18s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#141210";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,18,16,.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(20,18,16,.18)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <ArrowLeft /> Назад
            </button>
          )}

          {!showDone && (
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                padding: "0 22px",
                borderRadius: 999,
                background: canNext ? "#E86A3A" : "rgba(20,18,16,.18)",
                color: "#fff",
                border: 0,
                fontSize: 15,
                fontWeight: 600,
                cursor: canNext ? "pointer" : "default",
                transition: "background .2s",
              }}
            >
              {nextLabel} <ArrowRight c="#fff" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

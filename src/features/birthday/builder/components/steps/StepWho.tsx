"use client";

import { useEffect, useMemo } from "react";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import type { BirthdayAgeSignalsState } from "../../hooks/useBirthdayAgeSignals";
import type { BirthdayGuestsGroup, BirthdayTheme } from "../../../types/birthday";
import { PartyForChildSection } from "../PartyForChildSection";
import { getRecommendedPartyThemeByChildInterests } from "../../lib/themeInterestMatch";

const GUESTS_OPTIONS: { value: BirthdayGuestsGroup; label: string }[] = [
  { value: "up5", label: "до 5" },
  { value: "5-10", label: "5–10" },
  { value: "10-15", label: "10–15" },
  { value: "15plus", label: "15+" },
];

const THEME_OPTIONS: {
  key: BirthdayTheme;
  label: string;
  emoji: string;
}[] = [
  { key: "princess", label: "Принцессы", emoji: "👑" },
  { key: "unicorn", label: "Единороги", emoji: "🦄" },
  { key: "art", label: "Творчество", emoji: "🎨" },
  { key: "dinosaur", label: "Динозавры", emoji: "🦕" },
  { key: "science", label: "Наука", emoji: "🔬" },
  { key: "any", label: "Любая", emoji: "🎈" },
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
  const { partyForChild, guestsGroup, theme, themeSelectionSource } = state.quiz;
  const interestSlugs = partyForChild?.interestSlugs ?? [];

  const recommendedTheme = useMemo(
    () => getRecommendedPartyThemeByChildInterests(interestSlugs),
    [interestSlugs],
  );

  useEffect(() => {
    if (!recommendedTheme) return;
    if (themeSelectionSource === "manual") return;
    if (theme === recommendedTheme.themeId && themeSelectionSource === "auto") return;

    setBasics({
      theme: recommendedTheme.themeId,
      themeSelectionSource: "auto",
    });
  }, [recommendedTheme, setBasics, theme, themeSelectionSource]);

  const hasInterestRecommendation = Boolean(partyForChild && recommendedTheme);

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
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            color: "#E86A3A",
          }}
        >
          именинник
        </span>
        ?
      </h2>

      <p style={{ maxWidth: 480, marginTop: 14, fontSize: 16, color: "#3A332B" }}>
        Поможет подобрать возраст, тематику и интересы.
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
              {guestOption.label} детей
            </Chip>
          ))}
        </div>
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
          Тематика праздника — можно изменить
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(20,18,16,.6)" }}>
          {hasInterestRecommendation
            ? "Мы подобрали вариант по интересам ребёнка"
            : "Выберите тематику праздника или оставьте любой вариант"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {THEME_OPTIONS.map((themeOption) => {
            const isSelected = theme === themeOption.key;
            const isAutoRecommended =
              themeSelectionSource === "auto" &&
              recommendedTheme?.themeId === themeOption.key &&
              isSelected;

            return (
              <button
                key={themeOption.key}
                type="button"
                onClick={() =>
                  setBasics({
                    theme: themeOption.key,
                    themeSelectionSource: "manual",
                  })
                }
                style={{
                  minHeight: 44,
                  padding: isAutoRecommended ? "8px 16px" : "0 16px",
                  borderRadius: 99,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  flexDirection: "column",
                  background: isSelected ? "#FFE8DC" : "#FAF7F1",
                  border: `1px solid ${isSelected ? "#E86A3A" : "rgba(20,18,16,.10)"}`,
                  color: isSelected ? "#C24E22" : "#141210",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                <span>
                  {themeOption.emoji} {themeOption.label}
                </span>
                {isAutoRecommended ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono, ui-monospace)",
                      fontSize: 9,
                      color: "rgba(20,18,16,.55)",
                      letterSpacing: ".06em",
                    }}
                  >
                    по интересам
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

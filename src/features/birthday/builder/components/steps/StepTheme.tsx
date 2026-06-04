"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BirthdayTheme } from "../../../types/birthday";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BuilderProgress } from "../BuilderProgress";
import { cn } from "@/lib/utils";
import {
  firstThemeForSoftPreselect,
  getRecommendedPartyThemeByChildInterests,
  partitionThemesByInterestMatch,
  type ThemeOption,
} from "../../lib/themeInterestMatch";

type BuilderHook = BirthdayBuilderWithGate;

/** Порядок тем фиксирован; «Любая» — в конце */
const THEME_OPTIONS: ThemeOption[] = [
  { value: "princess", emoji: "👑", label: "Принцессы" },
  { value: "superhero", emoji: "🦸", label: "Супергерои" },
  { value: "dinosaur", emoji: "🦕", label: "Динозавры" },
  { value: "unicorn", emoji: "🦄", label: "Единороги" },
  { value: "pirate", emoji: "🏴‍☠️", label: "Пираты" },
  { value: "science", emoji: "🔬", label: "Наука" },
  { value: "art", emoji: "🎨", label: "Творчество" },
  { value: "sport", emoji: "⚽", label: "Спорт" },
  { value: "any", emoji: "🎈", label: "Любая" },
];

function ThemeChipButton({
  opt,
  selected,
  showMatchBadge,
  onSelect,
}: {
  opt: ThemeOption;
  selected: boolean;
  showMatchBadge: boolean;
  onSelect: (t: BirthdayTheme) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(opt.value)}
      className={cn(
        "relative rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]",
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2",
        selected
          ? "border-[#EF8759]/80 bg-orange-50/90 shadow-sm ring-1 ring-[#EF8759]/25"
          : showMatchBadge
            ? "border-stone-200/90 bg-[#FFF9F6] text-foreground/90 hover:bg-[#FFF5F0] hover:border-stone-300/80"
            : "border-border/70 bg-white/80 text-foreground/90 hover:border-border hover:bg-muted/30",
      )}
    >
      <span className="whitespace-nowrap">
        {opt.emoji} {opt.label}
      </span>
      {showMatchBadge && (
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight",
            "bg-stone-100/90 text-stone-600 border border-stone-200/80",
            selected && "bg-stone-200/50 text-stone-700",
          )}
        >
          Подходит по интересам
        </span>
      )}
    </button>
  );
}

export function StepTheme({ builder }: { builder: BuilderHook }) {
  const { state, setBasics } = builder;
  const { theme, themeSelectionSource } = state.quiz;
  const partyForChild = state.quiz.partyForChild;
  const interestSlugs = partyForChild?.interestSlugs ?? [];
  const recommendedTheme = useMemo(
    () => getRecommendedPartyThemeByChildInterests(interestSlugs),
    [interestSlugs],
  );

  const { matched, rest, hasMatches } = useMemo(
    () => partitionThemesByInterestMatch(THEME_OPTIONS, interestSlugs),
    [interestSlugs],
  );

  const preselectScope = useMemo(() => {
    const bd = partyForChild?.birthDateIso ?? "";
    const ik = [...(partyForChild?.interestSlugs ?? [])].sort().join(",");
    return `${bd}|${ik}`;
  }, [partyForChild?.birthDateIso, partyForChild?.interestSlugs]);

  const lastAutoThemeScope = useRef<string | null>(null);

  useEffect(() => {
    if (themeSelectionSource === "manual") return;
    if (!partyForChild?.interestSlugs?.length || !hasMatches) return;
    if (lastAutoThemeScope.current === preselectScope) return;
    const pick = recommendedTheme?.themeId ?? firstThemeForSoftPreselect(matched);
    if (pick) {
      lastAutoThemeScope.current = preselectScope;
      setBasics({ theme: pick, themeSelectionSource: "auto" });
    }
  }, [
    theme,
    themeSelectionSource,
    partyForChild?.interestSlugs,
    hasMatches,
    matched,
    recommendedTheme,
    preselectScope,
    setBasics,
  ]);

  const handleThemeClick = (t: BirthdayTheme) => {
    setBasics({ theme: t, themeSelectionSource: "manual" });
  };

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground/85">
            Тематика праздника
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Подберём атмосферу под настроение — можно пропустить
          </p>
        </div>
        <BuilderProgress currentStep="theme" />
      </div>

      <div className="space-y-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-4 sm:px-4 sm:py-5">
        <h3 className="text-xs font-medium text-muted-foreground tracking-wide">
          Какая тематика ближе?
        </h3>

        {hasMatches ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Подходит вашему ребёнку
              </p>
              <div className="flex flex-wrap gap-2">
                {matched.map((opt) => (
                  <ThemeChipButton
                    key={opt.value}
                    opt={opt}
                    selected={theme === opt.value}
                    showMatchBadge
                    onSelect={handleThemeClick}
                  />
                ))}
              </div>
            </div>
            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  Другие варианты
                </p>
                <div className="flex flex-wrap gap-2">
                  {rest.map((opt) => (
                    <ThemeChipButton
                      key={opt.value}
                      opt={opt}
                      selected={theme === opt.value}
                      showMatchBadge={false}
                      onSelect={handleThemeClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rest.map((opt) => (
              <ThemeChipButton
                key={opt.value}
                opt={opt}
                selected={theme === opt.value}
                showMatchBadge={false}
                onSelect={handleThemeClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

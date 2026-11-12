"use client";

import { CalendarDays } from "lucide-react";
import { DateSlider } from "@/components/save-flow/DateSlider";
import { cn } from "@/lib/utils";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import { AGE_ANSWERS, upcomingDays, type WhenChoice } from "../../lib/dayScenarioUi/model";

const WHEN_OPTIONS: { key: WhenChoice; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "tomorrow", label: "Завтра" },
  { key: "weekend", label: "Выходные" },
  { key: "other", label: "Другой день" },
];

const tile = (on: boolean) =>
  cn(
    "mp-font-ui flex min-h-[60px] items-center justify-center gap-2 rounded-[20px] border-[1.5px] px-2 text-center text-[17px] font-semibold transition-colors",
    on
      ? "border-[var(--mp-chip-on-line)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]"
      : "border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] hover:border-[var(--mp-line-strong)]",
    PLAN_FOCUS,
  );

/**
 * Guest form of the «просто» mockup: two questions, nothing else. "Когда?" (today, tomorrow,
 * the weekend, another day) and "Сколько лет детям?" (several answers allowed).
 */
export function ScenarioParams({
  when,
  onWhen,
  otherIso,
  onOtherIso,
  todayIso,
  ageKeys,
  onToggleAge,
}: {
  when: WhenChoice;
  onWhen: (value: WhenChoice) => void;
  otherIso: string | null;
  onOtherIso: (iso: string) => void;
  todayIso: string;
  ageKeys: readonly string[];
  onToggleAge: (key: string) => void;
}) {
  return (
    <div>
      <p className="mp-font-ui m-0 text-[17px] leading-[1.45] text-[var(--mp-tx)]">Ответьте на два вопроса — мы подберём места и разложим по времени.</p>

      <p id="scenario-when" className="mp-font-ui m-0 mb-3 mt-7 text-[20px] font-bold text-[var(--mp-tx)]">Когда?</p>
      <div role="group" aria-labelledby="scenario-when" className="grid grid-cols-2 gap-2.5">
        {WHEN_OPTIONS.map((option) => (
          <button key={option.key} type="button" aria-pressed={when === option.key} onClick={() => onWhen(option.key)} className={tile(when === option.key)}>
            {option.key === "other" ? <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden /> : null}
            {option.label}
          </button>
        ))}
      </div>
      {when === "other" ? (
        <div className="mt-3">
          <DateSlider options={upcomingDays(todayIso)} selISO={otherIso} onSelect={onOtherIso} />
        </div>
      ) : null}

      <p id="scenario-ages" className="mp-font-ui m-0 mb-3 mt-7 text-[20px] font-bold text-[var(--mp-tx)]">Сколько лет детям?</p>
      <div role="group" aria-labelledby="scenario-ages" className="grid grid-cols-4 gap-2.5">
        {AGE_ANSWERS.map((answer) => (
          <button key={answer.key} type="button" aria-pressed={ageKeys.includes(answer.key)} onClick={() => onToggleAge(answer.key)} className={cn(tile(ageKeys.includes(answer.key)), "px-1")}>
            {answer.label}
          </button>
        ))}
      </div>
      <p className="mp-font-ui m-0 mt-2.5 text-[14px] text-[var(--mp-tx2)]">Можно выбрать несколько</p>
    </div>
  );
}

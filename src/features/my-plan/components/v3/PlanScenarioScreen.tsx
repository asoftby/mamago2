"use client";

import { Route } from "lucide-react";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import type { PlanItemWithActivity } from "../../types/event";
import { PlanScreenHead } from "./PlanScreenHead";

function formatDay(dateISO: string): string {
  const label = new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * «Сценарий дня» в модалке: шаги по времени из дел этого дня (как их собирает сценарий)
 * и переход на страницу сценария.
 */
export function PlanScenarioScreen({
  date,
  items,
  changed,
  onBack,
  onOpen,
}: {
  date: string;
  items: PlanItemWithActivity[];
  /** План изменился после сборки сценария. */
  changed: boolean;
  onBack: () => void;
  onOpen: () => void;
}) {
  const steps = items
    .map((item) => ({ item, ...planEntryDisplay(item) }))
    .filter((step) => step.time)
    .sort((a, b) => (a.time! < b.time! ? -1 : a.time! > b.time! ? 1 : 0));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="План" onBack={onBack} />
      <span className="mx-5 mb-3 inline-flex h-[30px] w-fit items-center rounded-full bg-[#ECEFD9] px-3 text-[13px] font-bold text-[#56602A] md:mx-8">
        Сценарий дня
      </span>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <h2 className="mp-font-display m-0 text-[26px] font-normal leading-[1.18] tracking-[-0.015em] text-[var(--mp-tx)]">
          {formatDay(date)}
        </h2>
        {changed ? (
          <p className="mt-2 text-[13.5px] font-semibold text-[var(--mp-ac-dark)]">План изменился после сборки сценария</p>
        ) : null}
        <ol className="m-0 mt-[18px] list-none p-0">
          {steps.map((step, index) => (
            <li key={step.item.id} className="relative grid grid-cols-[46px_18px_minmax(0,1fr)] items-start pb-3.5">
              {index < steps.length - 1 ? (
                <span aria-hidden className="absolute bottom-[-2px] left-[54px] top-3.5 w-0.5 bg-[var(--mp-line-strong)]" />
              ) : null}
              <span className="pt-px text-[14.5px] font-extrabold tabular-nums text-[var(--mp-tx)]">{step.time}</span>
              <span aria-hidden className="relative z-[1] mt-[5px] h-2.5 w-2.5 rounded-full border-2 border-[var(--mp-ac)] bg-[var(--mp-bg)]" />
              <span className="min-w-0">
                <b className="block text-[15.5px] font-bold leading-[1.35] text-[var(--mp-tx)]">{step.title}</b>
                {step.item.activity?.place?.title ? (
                  <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)]">{step.item.activity.place.title}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[var(--mp-ac-dark)] px-3.5 text-[16.5px] font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)]/90"
        >
          <Route className="h-5 w-5" aria-hidden />
          Открыть сценарий
        </button>
      </div>
    </div>
  );
}

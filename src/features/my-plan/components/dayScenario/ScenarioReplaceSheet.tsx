"use client";

import { SaveFlowContainer } from "@/components/activity/SaveFlowContainer";
import { MY_PLAN_V3_TOKENS } from "../v3/myPlanV3Tokens";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import { ExternalLink } from "lucide-react";
import { formatTime, itemHref, metaLine, type DraftItem } from "../../lib/dayScenarioUi/model";

export type ReplaceOption = {
  /** The point that would take the place. */
  fresh: DraftItem;
  /** The whole day as the engine computed it with that point in. */
  items: DraftItem[];
};

/** The alternatives: look at one ("Подробнее", new tab) or take it ("Выбрать"). */
export function ReplaceOptionsList({ options, city, onPick }: { options: ReplaceOption[]; city?: string; onPick: (option: ReplaceOption) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {options.map((option) => {
        const meta = metaLine(option.fresh.card);
        const href = itemHref(option.fresh, city);
        return (
          <li key={option.fresh.activityId} className="flex items-center gap-3 rounded-[22px] border border-[var(--mp-line)] bg-[var(--surface)] p-3">
            <span className="mp-font-ui w-[52px] shrink-0 text-[17px] font-bold tabular-nums text-[var(--mp-tx)]">{formatTime(option.fresh.startsAt)}</span>
            <span className="min-w-0 flex-1">
              <span className="mp-font-ui block text-[16px] font-semibold leading-[1.25] text-[var(--mp-tx)] [overflow-wrap:anywhere]">{option.fresh.card.title}</span>
              {meta ? <span className="mp-font-ui mt-0.5 block text-[14px] text-[var(--mp-tx2)]">{meta}</span> : null}
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Подробнее о «${option.fresh.card.title}» (откроется в новой вкладке)`}
                  className={`mp-font-ui mt-1 inline-flex min-h-8 items-center gap-1 rounded-full text-[14px] font-semibold text-[var(--mp-ac-dark)] underline-offset-2 hover:underline ${PLAN_FOCUS}`}
                >
                  Подробнее
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </a>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => onPick(option)}
              aria-label={`Выбрать «${option.fresh.card.title}»`}
              className={`mp-font-ui flex min-h-11 shrink-0 items-center rounded-full bg-[var(--mp-tx)] px-4 text-[15px] font-semibold text-[var(--surface)] transition-opacity hover:opacity-90 ${PLAN_FOCUS}`}
            >
              Выбрать
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Чем заменить?»: up to three alternatives for one point, in the same time slot. A bottom
 * sheet on a phone, a dialog on a desktop (SaveFlowContainer, as in the save flow).
 */
export function ScenarioReplaceSheet({
  open,
  onOpenChange,
  target,
  city,
  options,
  loading,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DraftItem | null;
  /** City slug of the page; without it the options have no "Подробнее" link. */
  city?: string;
  options: ReplaceOption[] | null;
  loading: boolean;
  onPick: (option: ReplaceOption) => void;
}) {
  return (
    <SaveFlowContainer open={open} onOpenChange={onOpenChange} title="Чем заменить?">
      {/* The sheet is portalled out of the plan widget, so it brings the widget's design tokens along. */}
      <div style={MY_PLAN_V3_TOKENS} className="flex flex-col gap-3 px-[18px] pb-6 pt-5">
        <div>
          <p className="mp-font-ui m-0 text-[21px] font-extrabold leading-[1.15] tracking-[-.02em] text-[var(--mp-tx)]">Чем заменить?</p>
          {target ? (
            <p className="mp-font-ui m-0 mt-1 text-[15px] text-[var(--mp-tx2)]">
              Вместо «{target.card.title}», около {formatTime(target.startsAt)}
            </p>
          ) : null}
        </div>
        {loading ? (
          <div aria-busy="true" role="status" aria-label="Ищем замену" className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] rounded-[22px] border border-[var(--mp-line)] bg-[var(--surface-hover)]" />
            ))}
          </div>
        ) : options && options.length > 0 ? (
          <ReplaceOptionsList options={options} city={city} onPick={onPick} />
        ) : (
          <p role="status" className="mp-font-ui m-0 rounded-[22px] bg-[var(--mp-card)] p-4 text-[15px] leading-[1.45] text-[var(--mp-tx2)]">
            Подходящих замен на это время нет. Оставьте как есть или нажмите «Другой вариант».
          </p>
        )}
      </div>
    </SaveFlowContainer>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import { PlanScreenHead } from "../v3/PlanScreenHead";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import { formatTime, metaLine, type DraftItem } from "../../lib/dayScenarioUi/model";

export type ReplaceOption = {
  /** The point that would take the place. */
  fresh: DraftItem;
  /** The whole day as the engine computed it with that point in. */
  items: DraftItem[];
};

const COVER_TINTS = ["linear-gradient(180deg,#F2C8A7,#E89460)", "linear-gradient(180deg,#CDE3D6,#9CC1AC)", "linear-gradient(180deg,#C7CCE6,#9298C4)"];

/** The alternatives: tap a row to look at it (preview screen), or take it with «Выбрать». */
export function ReplaceOptionsList({ options, onOpen, onPick }: { options: ReplaceOption[]; onOpen: (option: ReplaceOption) => void; onPick: (option: ReplaceOption) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {options.map((option, index) => {
        const meta = metaLine(option.fresh.card);
        const cover = option.fresh.card.coverImageUrl;
        return (
          <li key={option.fresh.activityId} className="flex items-center gap-1 rounded-[22px] border border-[var(--mp-line)] bg-[var(--surface)] p-2 pr-3">
            <button
              type="button"
              onClick={() => onOpen(option)}
              aria-label={`Посмотреть «${option.fresh.card.title}»`}
              className={`flex min-h-[72px] min-w-0 flex-1 items-center gap-3 rounded-[16px] p-1 text-left transition-colors hover:bg-[var(--mp-bg)] ${PLAN_FOCUS}`}
            >
              <span className="mp-font-ui w-[48px] shrink-0 text-[17px] font-bold tabular-nums text-[var(--mp-tx)]">{formatTime(option.fresh.startsAt)}</span>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote catalog covers, same as the other plan cards
                <img src={cover} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span aria-hidden className="h-14 w-14 shrink-0 rounded-xl" style={{ background: COVER_TINTS[index % COVER_TINTS.length] }} />
              )}
              <span className="min-w-0 flex-1">
                <span className="mp-font-ui block text-[16px] font-semibold leading-[1.25] text-[var(--mp-tx)] [overflow-wrap:anywhere]">{option.fresh.card.title}</span>
                {meta ? <span className="mp-font-ui mt-0.5 block text-[14px] text-[var(--mp-tx2)]">{meta}</span> : null}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--mp-tx2)]" strokeWidth={1.8} aria-hidden />
            </button>
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
 * «Чем заменить?»: a screen of the day scenario's stack (not a modal on top of a modal): up to three
 * alternatives for one point, in the same time slot. A row opens the preview of that alternative.
 */
export function ScenarioReplaceScreen({
  target,
  options,
  loading,
  onBack,
  onOpen,
  onPick,
}: {
  target: DraftItem | null;
  options: ReplaceOption[] | null;
  loading: boolean;
  onBack: () => void;
  onOpen: (option: ReplaceOption) => void;
  onPick: (option: ReplaceOption) => void;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="День" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 md:px-8">
        <p className="mp-font-ui m-0 text-[22px] font-bold leading-[1.15] tracking-[-.01em] text-[var(--mp-tx)]">Чем заменить?</p>
        {target ? (
          <p className="mp-font-ui m-0 mb-4 mt-1 text-[15px] text-[var(--mp-tx2)]">
            Вместо «{target.card.title}», около {formatTime(target.startsAt)}
          </p>
        ) : null}
        {loading ? (
          <div aria-busy="true" role="status" aria-label="Ищем замену" className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] rounded-[22px] border border-[var(--mp-line)] bg-[var(--surface-hover)]" />
            ))}
          </div>
        ) : options && options.length > 0 ? (
          <ReplaceOptionsList options={options} onOpen={onOpen} onPick={onPick} />
        ) : (
          <p role="status" className="mp-font-ui m-0 rounded-[22px] bg-[var(--mp-card)] p-4 text-[15px] leading-[1.45] text-[var(--mp-tx2)]">
            Подходящих замен на это время нет. Оставьте как есть или нажмите «Другой вариант».
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Car, SearchX } from "lucide-react";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import type { DraftErrorKind } from "../../hooks/useDayScenarioDraft";

const PRIMARY = `mp-font-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--mp-tx)] px-5 text-[15px] font-semibold text-[var(--surface)] transition-colors hover:opacity-90 ${PLAN_FOCUS}`;
const QUIET = `mp-font-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--mp-line-strong)] bg-[var(--surface)] px-5 text-[15px] font-semibold text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)] ${PLAN_FOCUS}`;

function Panel({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div role="status" className="mt-4 flex flex-col items-center gap-2 rounded-3xl bg-[var(--mp-card)] px-[18px] py-5 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--mp-ac-dark)]">{icon}</span>
      <p className="mp-font-ui m-0 text-[20px] font-extrabold leading-tight tracking-[-.015em] text-[var(--mp-tx)]">{title}</p>
      {children ? <p className="mp-font-ui m-0 text-[14.5px] leading-[1.45] text-[var(--mp-tx2)]">{children}</p> : null}
      {actions ? <div className="mt-2 flex w-full flex-col gap-2">{actions}</div> : null}
    </div>
  );
}

/** Walking found too little: say so, and offer the car in one tap. */
export function FewNearbyBanner({ onSwitchToCar }: { onSwitchToCar: () => void }) {
  return (
    <div role="status" className="mt-4 flex items-center gap-3 rounded-[22px] bg-[var(--mp-ac-soft)] p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--mp-ac-dark)]">
        <Car className="h-5 w-5" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mp-font-ui m-0 text-[15.5px] font-semibold leading-[1.3] text-[var(--mp-tx)]">Рядом мало вариантов</p>
        <p className="mp-font-ui m-0 text-[14px] text-[var(--mp-tx2)]">Подобрать на машине?</p>
      </div>
      <button type="button" onClick={onSwitchToCar} className={`${PRIMARY} min-h-11 shrink-0 px-4`}>
        На машину
      </button>
    </div>
  );
}

/** Nothing fits the day. Says what to try next instead of leaving a blank screen. */
export function EmptyResult({
  walking,
  onSwitchToCar,
  onChangeParams,
  changeLabel,
}: {
  walking: boolean;
  onSwitchToCar: () => void;
  onChangeParams: () => void;
  changeLabel: string;
}) {
  return (
    <Panel
      icon={<SearchX className="h-5 w-5" strokeWidth={1.8} aria-hidden />}
      title="На этот день ничего не нашли"
      actions={
        <>
          {walking ? (
            <button type="button" onClick={onSwitchToCar} className={PRIMARY}>
              <Car className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              Подобрать на машине
            </button>
          ) : null}
          <button type="button" onClick={onChangeParams} className={walking ? QUIET : PRIMARY}>
            {changeLabel}
          </button>
        </>
      }
    >
      Попробуйте другой день{walking ? " или поездку на машине" : ""}.
    </Panel>
  );
}

const ERROR_TEXT: Record<DraftErrorKind, string> = {
  rate_limited: "Слишком много запросов подряд. Подождите минуту и попробуйте снова.",
  unavailable: "Подбор дня сейчас недоступен.",
  failed: "Не получилось собрать день. Проверьте интернет и попробуйте ещё раз.",
};

export function DraftError({ kind, onRetry }: { kind: DraftErrorKind; onRetry: () => void }) {
  return (
    <Panel
      icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.8} aria-hidden />}
      title="Не получилось"
      actions={
        kind === "unavailable" ? null : (
          <button type="button" onClick={onRetry} className={PRIMARY}>
            Повторить
          </button>
        )
      }
    >
      {ERROR_TEXT[kind]}
    </Panel>
  );
}

/** Loading placeholder with the shape of the result, so the screen does not jump. */
export function DraftSkeleton() {
  return (
    <div aria-busy="true" aria-label="Собираем день" role="status" className="mt-4 flex animate-pulse flex-col gap-3 motion-reduce:animate-none">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 rounded-[24px] border border-[var(--mp-line)] bg-[var(--surface)] p-3">
          <div className="h-5 w-[52px] shrink-0 rounded bg-[var(--surface-hover)]" />
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-[var(--surface-hover)]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-3/4 rounded bg-[var(--surface-hover)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--surface-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

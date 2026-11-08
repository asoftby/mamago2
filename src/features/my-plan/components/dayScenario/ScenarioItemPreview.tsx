"use client";

import { ArrowLeftRight, CalendarDays, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { dayTitle, isoDateOf, itemHref, itemNotes, priceLabel, timeRange, type DraftItem } from "../../lib/dayScenarioUi/model";
import { PlanScreenHead } from "../v3/PlanScreenHead";
import { PLAN_FOCUS } from "../v3/planChipStyles";

const COVER_FALLBACK = "linear-gradient(180deg,#F2C8A7,#E89460)";
const PRIMARY = `mp-font-ui flex h-[58px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[18px] bg-[var(--mp-ac-dark)] px-3.5 text-[16.5px] font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)]/90 disabled:opacity-40 ${PLAN_FOCUS}`;
const ICON_BTN = `flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-ac-dark)] transition-colors hover:bg-[var(--mp-ac-soft)] disabled:opacity-40 ${PLAN_FOCUS}`;

/**
 * A point of the day without leaving the widget: cover, when, where, price, what to double-check.
 * Opened from a card of the day ("view": replace or remove it) and from an alternative of
 * «Чем заменить?» ("pick": take it). Everything shown is already in the draft, so opening it asks
 * nothing from the server; the public page is one tap away in a new tab, the draft stays here.
 */
export function ScenarioItemPreview({
  item,
  city,
  back,
  onBack,
  busy = false,
  onReplace,
  onRemove,
  onPick,
}: {
  item: DraftItem;
  city?: string;
  /** Label of the "‹" button: where it leads. */
  back: string;
  onBack: () => void;
  busy?: boolean;
  /** "view" actions. */
  onReplace?: () => void;
  onRemove?: () => void;
  /** "pick" action: take this point instead of the replaced one. */
  onPick?: () => void;
}) {
  const { card } = item;
  const href = itemHref(item, city);
  const price = priceLabel(card);
  const notes = itemNotes(item);
  const isEvent = item.kind === "event";

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back={back} onBack={onBack} />
      <span
        className={`mx-5 mb-3 inline-flex h-[30px] w-fit items-center rounded-full px-3 text-[13px] font-bold md:mx-8 ${isEvent ? "bg-[var(--mp-ac-soft)] text-[var(--mp-ac-dark)]" : "bg-[#E4E6F4] text-[#454C86]"}`}
      >
        {isEvent ? "Из афиши" : "Место"}
      </span>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[var(--mp-soft)]" style={card.coverImageUrl ? undefined : { background: COVER_FALLBACK }}>
          {card.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote catalog covers, same as the other plan screens
            <img src={card.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="mt-[18px] flex items-start gap-3">
          <h2 className="mp-font-display m-0 min-w-0 flex-1 text-[26px] font-normal leading-[1.18] tracking-[-0.015em] text-[var(--mp-tx)] [overflow-wrap:anywhere] [text-wrap:pretty]">
            {card.title}
          </h2>
          {card.ageLabel ? (
            <span className="mt-[3px] inline-flex h-[30px] max-w-[40%] shrink-0 items-center whitespace-nowrap rounded-[9px] border-[1.5px] border-[var(--mp-tx)] px-[11px] text-sm font-extrabold text-[var(--mp-tx)]">
              {card.ageLabel}
            </span>
          ) : null}
        </div>

        <div className="mx-0.5 mt-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-3 text-[15.5px] leading-[1.35]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <b className="block font-bold text-[var(--mp-tx)]">
                {dayTitle(isoDateOf(item.startsAt))} · {timeRange(item.startsAt, item.endsAt)}
              </b>
              {[card.categoryName, price].filter(Boolean).length > 0 ? (
                <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)]">{[card.categoryName, price].filter(Boolean).join(" · ")}</span>
              ) : null}
            </span>
          </div>
          {card.address ? (
            <div className="flex items-start gap-3 text-[15.5px] leading-[1.35]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <b className="block font-bold text-[var(--mp-tx)] [overflow-wrap:anywhere]">{card.address}</b>
              </span>
            </div>
          ) : null}
        </div>

        {notes.length > 0 ? <p className="mp-font-ui m-0 mt-3.5 rounded-2xl bg-[var(--mp-card)] p-3.5 text-[14px] font-medium leading-[1.4] text-[var(--mp-ac-dark)]">{notes.join(" · ")}</p> : null}

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener"
            aria-label={`${isEvent ? "Открыть в афише" : "Открыть страницу места"} «${card.title}» (откроется в новой вкладке)`}
            className={`mx-auto mt-3.5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2.5 text-[15.5px] font-bold text-[var(--mp-ac-dark)] no-underline transition-colors hover:text-[var(--mp-ac)] ${PLAN_FOCUS}`}
          >
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            {isEvent ? "Открыть в афише" : "Страница места"}
          </a>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2.5 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        {onPick ? (
          <button type="button" onClick={onPick} className={PRIMARY}>
            Выбрать это
          </button>
        ) : (
          <>
            {onRemove ? (
              <button type="button" onClick={onRemove} disabled={busy} aria-label="Убрать из дня" title="Убрать из дня" className={ICON_BTN}>
                <Trash2 className="h-[22px] w-[22px]" aria-hidden />
              </button>
            ) : null}
            {onReplace ? (
              <button type="button" onClick={onReplace} disabled={busy} className={PRIMARY}>
                <ArrowLeftRight className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                Заменить
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

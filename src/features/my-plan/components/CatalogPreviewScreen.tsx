"use client";

import type { ReactNode } from "react";
import { CalendarClock, CalendarDays, MapPin, BookOpen, Trash2, Wallet } from "lucide-react";
import { PlanScreenHead } from "./v3/PlanScreenHead";

/**
 * The ONE short preview of a catalog entity inside the plan widget: an event, a class, a place, an offer, an
 * article, a point of a day scenario. Callers (PlanEventScreen, PlanEntryScreen, PlanArticleScreen,
 * ScenarioItemPreview) only translate their data into these props; layout, cover, title, rows, the link slot and the
 * bottom bar live here, so there is no parallel variant to keep in step.
 */

export type PreviewTone = "event" | "class" | "place" | "offer" | "article";
export type PreviewRow = { icon: "date" | "place" | "price" | "read"; primary: ReactNode; secondary?: ReactNode };

const TONE: Record<PreviewTone, string> = {
  event: "bg-[var(--mp-ac-soft)] text-[var(--mp-ac-dark)]",
  class: "bg-[#E4E6F4] text-[#454C86]",
  place: "bg-[#E4E6F4] text-[#454C86]",
  offer: "bg-[#F4EBD8] text-[#7A5A1F]",
  article: "bg-[#E3ECDF] text-[#3D5A36]",
};
const ICON = { date: CalendarDays, place: MapPin, price: Wallet, read: BookOpen } as const;
const COVER_FALLBACK = "linear-gradient(180deg,#F2C8A7,#E89460)";

export const PREVIEW_ICON_BUTTON =
  "flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-ac-dark)] transition-colors hover:bg-[var(--mp-ac-soft)] disabled:opacity-40";
export const PREVIEW_PRIMARY =
  "flex h-[58px] min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-[18px] bg-[var(--mp-ac-dark)] px-3.5 text-[16.5px] font-bold text-white no-underline transition-colors hover:bg-[var(--mp-ac-dark)]/90 hover:text-white disabled:opacity-40";

export function CatalogPreviewScreen({
  back,
  onBack,
  badge,
  tone,
  fromScenario = false,
  coverUrl,
  coverMode = "always",
  title,
  ageLabel,
  rows,
  note,
  linkSlot,
  footer,
}: {
  /** Label of the "‹" button: where it leads. */
  back: string;
  onBack: () => void;
  badge: string;
  tone: PreviewTone;
  /** A point saved by the day scenario: a ✦ «от mamaGo» chip next to the badge. */
  fromScenario?: boolean;
  coverUrl: string | null;
  /** "always": a cover block even without a picture (events, places); "ifPresent": no block (articles). */
  coverMode?: "always" | "ifPresent";
  title: string;
  ageLabel?: string | null;
  rows: PreviewRow[];
  /** A highlighted note under the rows (what to double-check). */
  note?: string | null;
  /** The link to the public page (callers decide Link vs new tab). */
  linkSlot?: ReactNode;
  /** The bottom bar: use PreviewFooterButtons and the PREVIEW_* classes. */
  footer: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back={back} onBack={onBack} />
      <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 md:mx-8">
        <span className={`inline-flex h-[30px] w-fit items-center rounded-full px-3 text-[13px] font-bold ${TONE[tone]}`}>{badge}</span>
        {fromScenario ? (
          <span className="inline-flex h-[30px] items-center gap-1 rounded-full border border-[var(--mp-line)] bg-[var(--mp-card)] px-3 text-[13px] font-semibold text-[var(--mp-ac-dark)]">
            <span aria-hidden>✦</span> от mamaGo
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        {coverUrl || coverMode === "always" ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[var(--mp-soft)]" style={coverUrl ? undefined : { background: COVER_FALLBACK }}>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote catalog covers, same as the other plan screens
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        ) : null}

        <div className="mt-[18px] flex items-start gap-3">
          <h2 className="mp-font-display m-0 min-w-0 flex-1 text-[26px] font-normal leading-[1.18] tracking-[-0.015em] text-[var(--mp-tx)] [overflow-wrap:anywhere] [text-wrap:pretty]">{title}</h2>
          {ageLabel ? (
            <span className="mt-[3px] inline-flex h-[30px] max-w-[40%] shrink-0 items-center whitespace-nowrap rounded-[9px] border-[1.5px] border-[var(--mp-tx)] px-[11px] text-sm font-extrabold text-[var(--mp-tx)]">{ageLabel}</span>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="mx-0.5 mt-3.5 flex flex-col gap-3">
            {rows.map((row, index) => {
              const Icon = ICON[row.icon];
              return (
                <div key={index} className="flex items-start gap-3 text-[15.5px] leading-[1.35]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <b className="block font-bold text-[var(--mp-tx)] [overflow-wrap:anywhere]">{row.primary}</b>
                    {row.secondary ? <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)] [overflow-wrap:anywhere]">{row.secondary}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {note ? <p className="mp-font-ui m-0 mt-3.5 rounded-2xl bg-[var(--mp-card)] p-3.5 text-[14px] font-medium leading-[1.4] text-[var(--mp-ac-dark)]">{note}</p> : null}
        {linkSlot}
      </div>
      <div className="flex shrink-0 gap-2.5 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">{footer}</div>
    </div>
  );
}

/** «Удалить из плана» and «Перенести» icon buttons, the same on every preview. */
export function PreviewFooterButtons({ onRemove, onMove, removeLabel = "Удалить из плана", disabled = false }: { onRemove?: () => void; onMove?: () => void; removeLabel?: string; disabled?: boolean }) {
  return (
    <>
      {onRemove ? (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={removeLabel} title={removeLabel} className={PREVIEW_ICON_BUTTON}>
          <Trash2 className="h-[22px] w-[22px]" aria-hidden />
        </button>
      ) : null}
      {onMove ? (
        <button type="button" onClick={onMove} disabled={disabled} aria-label="Перенести" title="Перенести" className={`${PREVIEW_ICON_BUTTON} !text-[var(--mp-tx)] hover:!bg-[var(--mp-card)] hover:border-[var(--mp-line-strong)]`}>
          <CalendarClock className="h-[22px] w-[22px]" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

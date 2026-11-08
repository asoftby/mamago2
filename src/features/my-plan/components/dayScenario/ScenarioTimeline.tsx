"use client";

import { Fragment } from "react";
import { ArrowLeftRight, Car, Footprints, Lock, X } from "lucide-react";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import { formatTime, itemNotes, legLabel, metaLine, type DraftItem } from "../../lib/dayScenarioUi/model";

/** Entries the user already has on the day (notes, tickets): shown in place, never touched. */
export type OwnPlanEntry = { startsAt: string | null; title: string };

/** Tints for a card without a cover (from the «просто» mockup): warm, sage, dusk. */
const COVER_TINTS = [
  "linear-gradient(180deg,#F2C8A7,#E89460)",
  "linear-gradient(180deg,#CDE3D6,#9CC1AC)",
  "linear-gradient(180deg,#C7CCE6,#9298C4)",
];

type Row =
  | { kind: "stop"; at: number; item: DraftItem; index: number }
  | { kind: "own"; at: number; entry: OwnPlanEntry };

/** Draft points and the user's own timed entries in one chronological list; untimed entries are left out. */
export function mergeTimeline(items: readonly DraftItem[], own: readonly OwnPlanEntry[]): Row[] {
  const rows: Row[] = items.map((item, index) => ({ kind: "stop", at: Date.parse(item.startsAt), item, index }));
  for (const entry of own) {
    if (entry.startsAt) rows.push({ kind: "own", at: Date.parse(entry.startsAt), entry });
  }
  return rows.sort((a, b) => a.at - b.at);
}

function Cover({ item, index }: { item: DraftItem; index: number }) {
  const url = item.card.coverImageUrl;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote catalog covers, same as the other plan cards
    <img src={url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
  ) : (
    <span aria-hidden className="h-16 w-16 shrink-0 rounded-2xl" style={{ background: COVER_TINTS[index % COVER_TINTS.length] }} />
  );
}

function StopCard({
  item,
  index,
  busy,
  onRemove,
  onReplace,
}: {
  item: DraftItem;
  index: number;
  busy: boolean;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const notes = itemNotes(item);
  const meta = metaLine(item.card);
  return (
    <li className="relative list-none">
      <span aria-hidden className="absolute -left-7 top-[22px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--mp-ac)] bg-[var(--surface)]">
        <span className="h-2 w-2 rounded-full bg-[var(--mp-ac)]" />
      </span>
      <div className="relative flex flex-wrap items-start gap-3 rounded-[24px] border border-[var(--mp-line)] bg-[var(--surface)] p-3 shadow-[0_8px_18px_-14px_rgba(20,18,16,.3)]">
        <span className="mp-font-ui w-[52px] shrink-0 pt-0.5 text-[19px] font-bold tabular-nums text-[var(--mp-tx)]">{formatTime(item.startsAt)}</span>
        <Cover item={item} index={index} />
        <div className="min-w-0 flex-1">
          <p className="mp-font-ui m-0 pr-9 text-[17px] font-semibold leading-[1.25] text-[var(--mp-tx)] [overflow-wrap:anywhere]">{item.card.title}</p>
          {meta ? <p className="mp-font-ui m-0 mt-[3px] text-[14.5px] text-[var(--mp-tx2)]">{meta}</p> : null}
          {notes.length > 0 ? (
            <p className="mp-font-ui m-0 mt-1 text-[13px] font-medium text-[var(--mp-ac-dark)]">{notes.join(" · ")}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Убрать «${item.card.title}»`}
          className={`absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)] transition-colors hover:bg-[var(--mp-bg)] hover:text-[var(--mp-tx)] disabled:opacity-40 ${PLAN_FOCUS}`}
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </button>
        <div className="basis-full">
          <button
            type="button"
            onClick={onReplace}
            disabled={busy}
            className={`mp-font-ui inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--mp-line)] bg-[var(--mp-bg)] px-3 text-[14px] font-semibold text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)] disabled:opacity-40 ${PLAN_FOCUS}`}
          >
            <ArrowLeftRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Заменить
          </button>
        </div>
      </div>
    </li>
  );
}

function TravelLeg({ travel }: { travel: DraftItem["travel"] }) {
  const label = legLabel(travel);
  if (!travel || !label) return null;
  const Icon = travel.mode === "walk" ? Footprints : Car;
  return (
    <li className="relative flex list-none items-center gap-2 py-3 pl-1 text-[14px] text-[var(--mp-tx2)]">
      <span aria-hidden className="absolute -left-[30px] flex h-6 w-6 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-[var(--surface)]">
        <Icon className="h-[13px] w-[13px]" strokeWidth={1.8} />
      </span>
      <span className="mp-font-ui">{label}</span>
    </li>
  );
}

function OwnRow({ entry }: { entry: OwnPlanEntry }) {
  return (
    <li className="relative mt-3 flex list-none items-center gap-3 rounded-[24px] bg-[var(--mp-card)] p-3.5 text-[var(--mp-tx2)]">
      <span aria-hidden className="absolute -left-7 top-1/2 -mt-2.5 h-5 w-5 rounded-full border-2 border-[var(--mp-line-strong)] bg-[var(--surface)]" />
      <span className="mp-font-ui w-[52px] shrink-0 text-[19px] font-bold tabular-nums">{entry.startsAt ? formatTime(entry.startsAt) : ""}</span>
      <div className="min-w-0 flex-1">
        <p className="mp-font-ui m-0 text-[17px] font-semibold text-[var(--mp-tx)] [overflow-wrap:anywhere]">{entry.title}</p>
        <p className="mp-font-ui m-0 text-[14px]">уже в плане</p>
      </div>
      <Lock className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
    </li>
  );
}

/**
 * The day as a rail: a card per point with the travel time between them, and the user's own
 * entries in their place. A leg is printed once, above the point it leads to.
 */
export function ScenarioTimeline({
  items,
  ownEntries = [],
  busy,
  onRemove,
  onReplace,
}: {
  items: readonly DraftItem[];
  ownEntries?: readonly OwnPlanEntry[];
  busy: boolean;
  onRemove: (item: DraftItem) => void;
  onReplace: (item: DraftItem) => void;
}) {
  const rows = mergeTimeline(items, ownEntries);
  return (
    <ol
      aria-label="План дня"
      className="relative m-0 mt-4 flex list-none flex-col p-0 pl-7 before:absolute before:bottom-[30px] before:left-[9px] before:top-[30px] before:w-0.5 before:rounded-sm before:bg-[linear-gradient(var(--mp-ac),#f7c3ad)] before:content-['']"
    >
      {rows.map((row, i) =>
        row.kind === "own" ? (
          <OwnRow key={`own-${i}`} entry={row.entry} />
        ) : (
          <Fragment key={row.item.activityId}>
            <TravelLeg travel={row.item.travel} />
            <StopCard item={row.item} index={row.index} busy={busy} onRemove={() => onRemove(row.item)} onReplace={() => onReplace(row.item)} />
          </Fragment>
        ),
      )}
    </ol>
  );
}

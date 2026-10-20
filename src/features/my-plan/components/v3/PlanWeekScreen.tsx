"use client";

import { ChevronRight } from "lucide-react";
import type { PlanItemWithActivity } from "../../types/event";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import { PlanScreenTitleHead } from "./PlanScreenTitleHead";

function dateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function byDateAndTime(a: PlanItemWithActivity, b: PlanItemWithActivity): number {
  const dateOrder = a.date.localeCompare(b.date);
  if (dateOrder !== 0) return dateOrder;
  const time = (item: PlanItemWithActivity) =>
    item.startsAt ? new Date(item.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
  return time(a) - time(b);
}

/**
 * Second screen of the same My Plan overlay. Selecting an event opens its day
 * in the first screen without dismissing the modal or losing the calendar.
 */
export function PlanWeekScreen({
  items,
  onBack,
  onSelectDate,
}: {
  items: PlanItemWithActivity[];
  onBack: () => void;
  onSelectDate: (date: string) => void;
}) {
  const groups = new Map<string, PlanItemWithActivity[]>();
  for (const item of [...items].sort(byDateAndTime)) {
    groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenTitleHead
        title={<>Ближайшие <em>события</em></>}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-8 pt-2 md:px-8">
        {groups.size === 0 ? (
          <p className="rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] p-[18px] text-[15px] text-[var(--mp-tx2)]">
            На оставшиеся дни этой недели событий пока нет.
          </p>
        ) : (
          [...groups].map(([date, dayItems]) => (
            <section key={date} aria-label={dateLabel(date)}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-bold capitalize text-[var(--mp-tx)]">
                  {dateLabel(date)}
                </h3>
                <span className="text-xs text-[var(--mp-tx2)]">{dayItems.length}</span>
              </div>
              <div className="space-y-2">
                {dayItems.map((item) => {
                  const { title, poster, time } = planEntryDisplay(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectDate(date)}
                      className="flex min-h-[70px] w-full items-center gap-3 rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-3 py-2 text-left transition-colors hover:border-[var(--mp-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poster} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--mp-soft)] text-xs font-semibold text-[var(--mp-tx2)]">
                          {time ?? "—"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--mp-tx)]">
                          {title}
                        </span>
                        {time ? <span className="mt-1 block text-xs text-[var(--mp-tx2)]">{time}</span> : null}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--mp-tx2)]" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { MediaCover } from "@/components/ui/media-cover";
import { AssignScenarioTimeControl } from "./AssignScenarioTimeControl";
import type { ActivityAddressLabel } from "@/features/my-plan/lib/formatActivityAddress";

export type ScenarioTimelineItem = {
  id: string;
  title: string;
  href: string | null;
  address: ActivityAddressLabel | null;
  durationMinutes: number | null;
  imageUrl: string | null;
  effectiveStartsAt: Date | null;
  isFlexible: boolean;
  /** "HH:MM" if a Scenario override time is currently assigned. */
  overrideTime: string | null;
  hasConflict: boolean;
  conflictOverlapMinutes: number | null;
  /** Free time between the previous item and this one, in minutes. */
  freeGapBeforeMinutes: number | null;
};

type ScenarioTimelineProps = {
  items: ScenarioTimelineItem[];
  city: string;
  date: string;
};

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
}

function GapBlock({ minutes }: { minutes: number }) {
  return (
    <div className="relative flex gap-4 py-1">
      <div className="w-10 shrink-0" />
      <p className="text-xs font-medium text-neutral-400">
        {formatDurationLabel(minutes)} свободно
      </p>
    </div>
  );
}

export function ScenarioTimeline({ items, city, date }: ScenarioTimelineProps) {
  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-neutral-200" />
      <div className="space-y-1">
        {items.map((item, index) => {
          const previous = index > 0 ? items[index - 1] : null;

          return (
            <div key={item.id}>
              {previous && item.freeGapBeforeMinutes ? (
                <GapBlock minutes={item.freeGapBeforeMinutes} />
              ) : null}

              <div className="relative flex gap-4 py-2">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-start justify-center pt-1">
                  <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-primary">
                    {item.effectiveStartsAt ? formatTime(item.effectiveStartsAt) : "Гибкое время"}
                  </p>

                  <div className="mt-1.5 rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-base font-semibold leading-snug text-neutral-900 hover:underline"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <h3 className="text-base font-semibold leading-snug text-neutral-900">
                            {item.title}
                          </h3>
                        )}
                        {item.address?.cityLabel || item.address?.streetAddressLabel ? (
                          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                            {[item.address.cityLabel, item.address.streetAddressLabel]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                        {item.address?.metroLabel ? (
                          <p className="mt-0.5 text-xs text-neutral-400">{item.address.metroLabel}</p>
                        ) : null}
                        {item.durationMinutes != null ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                            {formatDurationLabel(item.durationMinutes)}
                          </p>
                        ) : null}
                        {item.hasConflict ? (
                          <p className="mt-1.5 text-sm font-medium text-amber-600">
                            ⚠ Время пересекается
                            {item.conflictOverlapMinutes
                              ? ` на ${formatDurationLabel(item.conflictOverlapMinutes)}`
                              : ""}
                          </p>
                        ) : null}
                        {item.isFlexible ? (
                          <AssignScenarioTimeControl
                            city={city}
                            date={date}
                            planItemId={item.id}
                            currentTime={item.overrideTime}
                          />
                        ) : null}
                      </div>
                      {item.imageUrl ? (
                        <div className="w-14 shrink-0">
                          <MediaCover
                            imageUrl={item.imageUrl}
                            alt={item.title}
                            ratio="1/1"
                            className="rounded-2xl"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

export type EventCalendarSummary = {
  date: string;
  time: string;
  activityId: string;
  sessionId: string | null;
  title: string;
  bookings: number;
  adults: number;
  children: number;
  newCount: number;
  confirmedCount: number;
};

type Group = {
  activityId: string | null;
  selectedSessionId: string | null;
  requestedDate: Date | null;
  requestedTime: string | null;
  status: string;
  _count: { _all: number };
  _sum: { adultsCount: number | null; childrenCount: number | null };
};

/** No PII: aggregate by event occurrence and day without the inbox's 200-row cap. */
export function buildEventCalendarSummary(
  groups: readonly Group[],
  sessions: ReadonlyMap<string, { startsAt: Date }>,
  titles: ReadonlyMap<string, string>,
): EventCalendarSummary[] {
  const keyed = new Map<string, EventCalendarSummary>();
  for (const group of groups) {
    if (!group.activityId) continue;
    const session = group.selectedSessionId ? sessions.get(group.selectedSessionId) : undefined;
    const date = session ? getLocalDateKey(session.startsAt) : group.requestedDate?.toISOString().slice(0, 10);
    if (!date) continue;
    const time = session ? formatHHMM(session.startsAt) : (group.requestedTime ?? "");
    const key = group.activityId + "|" + date + "|" + time;
    const previous = keyed.get(key);
    const next: EventCalendarSummary = previous ?? {
      activityId: group.activityId, date, time,
      sessionId: group.selectedSessionId ?? null,
      title: titles.get(group.activityId) ?? "Событие",
      bookings: 0, adults: 0, children: 0, newCount: 0, confirmedCount: 0,
    };
    next.sessionId ??= group.selectedSessionId;
    next.bookings += group._count._all;
    next.adults += group._sum.adultsCount ?? 0;
    next.children += group._sum.childrenCount ?? 0;
    if (group.status === "NEW") next.newCount += group._count._all;
    if (group.status === "CONFIRMED") next.confirmedCount += group._count._all;
    keyed.set(key, next);
  }
  return [...keyed.values()].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

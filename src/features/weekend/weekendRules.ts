import { addDaysLocal } from "@/lib/date/localDateKey";

export type WeekendStop = {
  key: string;
  kind: "activity" | "place";
  id: string;
  title: string;
  description: string;
  href: string;
  imageUrl: string | null;
  address: string | null;
  startsAt: string | null;
  sessionId: string | null;
  /** An opening time or event duration is never invented. */
  rating: number | null;
  coords: { lat: number; lng: number } | null;
  reason: string;
};

export type WeekendPlanEntry = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  noteWithoutTime: boolean;
  kind: "task" | "catalog";
  activityId: string | null;
  placeId: string | null;
};

export type WeekendData = {
  date: string;
  city: string;
  childrenLabel: string;
  interestLabels: string[];
  candidates: WeekendStop[];
  initialKeys: string[];
  existing: WeekendPlanEntry[];
  candidateCount: number;
  algorithmVersion: string;
};

export type WeekendConflict = {
  planId: string;
  planTitle: string;
  severity: "conflict" | "possible";
};

export function isWeekendDateInWindow(date: string, today: string, maxDays = 62): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T12:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const day = parsed.getUTCDay();
  return (day === 0 || day === 6) && date >= today && date <= addDaysLocal(today, maxDays);
}

export function nextWeekendDates(today: string): [string, string] {
  const weekDay = new Date(today + "T12:00:00.000Z").getUTCDay();
  const untilSaturday = (6 - weekDay + 7) % 7;
  const saturday = addDaysLocal(today, untilSaturday);
  return [saturday, addDaysLocal(saturday, 1)];
}

/** Only known times can produce a certain conflict; never assume a duration for missing endsAt. */
export function findWeekendConflicts(stop: WeekendStop, existing: WeekendPlanEntry[]): WeekendConflict[] {
  if (!stop.startsAt) return [];
  const candidateStart = new Date(stop.startsAt).getTime();
  if (!Number.isFinite(candidateStart)) return [];
  return existing.flatMap<WeekendConflict>((item) => {
    if (!item.startsAt) return [];
    const planStart = new Date(item.startsAt).getTime();
    const planEnd = item.endsAt ? new Date(item.endsAt).getTime() : null;
    if (!Number.isFinite(planStart)) return [];
    if (candidateStart === planStart || (planEnd != null && candidateStart > planStart && candidateStart < planEnd)) {
      return [{ planId: item.id, planTitle: item.title, severity: "conflict" as const }];
    }
    if (planEnd == null && candidateStart > planStart) {
      // No duration: a later activity MAY collide; we cannot claim that it does.
      return [{ planId: item.id, planTitle: item.title, severity: "possible" as const }];
    }
    return [];
  });
}

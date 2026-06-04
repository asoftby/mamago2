import { formatLocalPlanDate, getLocalDateKey } from "@/lib/date/localDateKey";

type ActivityDateLike = {
  scheduleJson?: unknown | null;
  sessions?: Array<{ startsAt: Date }>;
};

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pushDateKey(bucket: Set<string>, value: unknown): void {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    bucket.add(getLocalDateKey(value));
    return;
  }

  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;

  const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (isoDateMatch) {
    const parsed = parseDateKey(isoDateMatch[1]);
    if (parsed) bucket.add(getLocalDateKey(parsed));
    return;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    bucket.add(getLocalDateKey(parsed));
  }
}

function extractScheduleJsonDateKeys(scheduleJson: unknown): string[] {
  if (!scheduleJson || typeof scheduleJson !== "object") return [];

  const json = scheduleJson as Record<string, unknown>;
  const keys = new Set<string>();

  pushDateKey(keys, json.date);
  pushDateKey(keys, json.startDate);
  pushDateKey(keys, json.endDate);
  pushDateKey(keys, json.dateFrom);
  pushDateKey(keys, json.dateTo);
  pushDateKey(keys, json.startsAt);
  pushDateKey(keys, json.endsAt);
  pushDateKey(keys, json.simpleBookingDate);

  if (Array.isArray(json.dates)) {
    for (const item of json.dates) {
      if (typeof item === "string" || item instanceof Date) {
        pushDateKey(keys, item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      pushDateKey(keys, record.date);
      pushDateKey(keys, record.isoDate);
      pushDateKey(keys, record.startsAt);
      pushDateKey(keys, record.dateFrom);
      pushDateKey(keys, record.dateTo);
    }
  }

  if (
    json.timeSlots &&
    typeof json.timeSlots === "object" &&
    Array.isArray((json.timeSlots as { dates?: unknown[] }).dates)
  ) {
    for (const item of (json.timeSlots as { dates: unknown[] }).dates) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      pushDateKey(keys, record.isoDate);
      pushDateKey(keys, record.date);
    }
  }

  return Array.from(keys).sort();
}

function collectActivityDateKeys(activity: ActivityDateLike): string[] {
  const sessionKeys = (activity.sessions ?? [])
    .map((session) => session.startsAt)
    .filter((startsAt): startsAt is Date => startsAt instanceof Date && !Number.isNaN(startsAt.getTime()))
    .map((startsAt) => getLocalDateKey(startsAt));

  if (sessionKeys.length > 0) {
    return Array.from(new Set(sessionKeys)).sort();
  }

  return extractScheduleJsonDateKeys(activity.scheduleJson);
}

export function getActivityDateDisplay(
  activity: ActivityDateLike,
  now: Date = new Date(),
): string | null {
  const dateKeys = collectActivityDateKeys(activity);
  if (dateKeys.length === 0) return null;

  const startKey = dateKeys[0]!;
  const endKey = dateKeys[dateKeys.length - 1]!;
  const startDate = parseDateKey(startKey);
  const endDate = parseDateKey(endKey);
  if (!startDate || !endDate) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (endDate.getTime() < today.getTime()) {
    return "Уже прошло";
  }

  if (startDate.getTime() <= today.getTime() && endDate.getTime() >= today.getTime()) {
    return sameLocalDay(endDate, today) ? "до сегодня" : `до ${formatLocalPlanDate(endKey, "ru-RU")}`;
  }

  if (dateKeys.length === 1) {
    return formatLocalPlanDate(startKey, "ru-RU");
  }

  return `с ${formatLocalPlanDate(startKey, "ru-RU")}`;
}

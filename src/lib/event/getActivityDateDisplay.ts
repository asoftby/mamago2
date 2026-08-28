import { formatLocalPlanDate, getLocalDateKey } from "@/lib/date/localDateKey";

type ActivityDateLike = {
  scheduleJson?: unknown | null;
  sessions?: Array<{ startsAt: Date }>;
};

function parseDateKey(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
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
    if (parsed) bucket.add(parsed);
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
  const todayKey = getLocalDateKey(now);

  // YYYY-MM-DD keys are lexicographically sortable and are all resolved in
  // Europe/Minsk. Avoid reconstructing ambient-local Date objects here.
  if (endKey < todayKey) {
    return "Уже прошло";
  }

  if (startKey <= todayKey && endKey >= todayKey) {
    return endKey === todayKey ? "до сегодня" : `до ${formatLocalPlanDate(endKey, "ru-RU")}`;
  }

  if (dateKeys.length === 1) {
    return formatLocalPlanDate(startKey, "ru-RU");
  }

  return `с ${formatLocalPlanDate(startKey, "ru-RU")}`;
}

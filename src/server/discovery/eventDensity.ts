import { zonedDateKey } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export function countEventSessionsByDay(sessions: Array<{ startsAt: Date }>, timeZone = DEFAULT_TZ): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    const key = zonedDateKey(session.startsAt, timeZone);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

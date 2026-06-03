import { ScheduleMode } from "@prisma/client";

export type EventTemporalState = "UPCOMING" | "ONGOING" | "PAST" | "UNKNOWN";

type EventTemporalStateInput = {
  scheduleMode: ScheduleMode;
  nextOccurrenceAt: Date | null;
  sessions?: Array<{ startsAt: Date }>;
  now?: Date;
};

const ONGOING_SCHEDULE_MODES = new Set<ScheduleMode>([
  ScheduleMode.ALWAYS,
  ScheduleMode.ON_DEMAND,
  ScheduleMode.RECURRING,
]);

export function getEventTemporalState({
  scheduleMode,
  nextOccurrenceAt,
  sessions = [],
  now = new Date(),
}: EventTemporalStateInput): EventTemporalState {
  const validSessionTimes = sessions
    .map((session) => session.startsAt)
    .filter((startsAt): startsAt is Date => startsAt instanceof Date && !Number.isNaN(startsAt.getTime()));

  if (validSessionTimes.length > 0) {
    const lastSessionAt = validSessionTimes.reduce((latest, current) =>
      current.getTime() > latest.getTime() ? current : latest,
    );

    if (lastSessionAt.getTime() < now.getTime()) {
      return "PAST";
    }

    return "UPCOMING";
  }

  if (nextOccurrenceAt instanceof Date && !Number.isNaN(nextOccurrenceAt.getTime())) {
    return nextOccurrenceAt.getTime() < now.getTime() ? "PAST" : "UPCOMING";
  }

  if (ONGOING_SCHEDULE_MODES.has(scheduleMode)) {
    return "ONGOING";
  }

  return "UNKNOWN";
}

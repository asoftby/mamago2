import assert from "node:assert/strict";
import { localWallClockToUtc } from "@/lib/date/localDateKey";
import { resolveScenarioScheduling } from "./scenarioScheduling";
import type { ScenarioItemTiming } from "./scenarioProjection";

function timing(startsAt: Date | null, isFlexible = false): ScenarioItemTiming {
  return {
    effectiveStartsAt: startsAt,
    isFlexible,
    timeSource: isFlexible ? "override" : startsAt ? "fixed" : "flexible",
  };
}

function at(date: string, time: string): Date {
  return localWallClockToUtc(date, time);
}

// Prisma nullable enum maps exactly to the domain's UNKNOWN state.
assert.equal(
  resolveScenarioScheduling({ activity: { schedulingKind: null, scheduleJson: null }, timing: timing(null) }).kind,
  "UNKNOWN",
);

// Canonical durationMinutes proves the end without any fallback.
{
  const start = at("2026-09-01", "10:00");
  const result = resolveScenarioScheduling({
    activity: { schedulingKind: "SLOT", scheduleJson: { durationMinutes: 90 } },
    timing: timing(start),
  });
  assert.equal(result.endsAt?.getTime(), at("2026-09-01", "11:30").getTime());
  assert.equal(result.durationMinutes, 90);
}

// An exact date+start match uses scheduleItems[].endTime before durationMinutes.
{
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        durationMinutes: 30,
        scheduleItems: [
          { date: "2026-09-01", startTime: "12:00", endTime: "14:00", allDay: false },
        ],
      },
    },
    timing: timing(at("2026-09-01", "12:00")),
  });
  assert.equal(result.endsAt?.getTime(), at("2026-09-01", "14:00").getTime());
  assert.equal(result.durationMinutes, 120);
}

// Same date but wrong start is not an exact occurrence match.
{
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", startTime: "12:00", endTime: "14:00", allDay: false },
        ],
      },
    },
    timing: timing(at("2026-09-01", "13:00")),
  });
  assert.equal(result.endsAt, null);
  assert.equal(result.durationMinutes, null);
}

// A target date inside an inclusive range uses that range's real endTime.
for (const targetDate of ["2026-09-01", "2026-09-03", "2026-09-05"]) {
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", dateEnd: "2026-09-05", startTime: "12:00", endTime: "14:00" },
        ],
      },
    },
    timing: timing(at(targetDate, "12:00")),
  });
  assert.equal(result.endsAt?.getTime(), at(targetDate, "14:00").getTime());
}

// Outside a range is not a match.
assert.equal(
  resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", dateEnd: "2026-09-05", startTime: "12:00", endTime: "14:00" },
        ],
      },
    },
    timing: timing(at("2026-09-06", "12:00")),
  }).endsAt,
  null,
);

// Exact single-date data wins over a containing range.
assert.equal(
  resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", dateEnd: "2026-09-05", startTime: "12:00", endTime: "14:00" },
          { date: "2026-09-03", startTime: "12:00", endTime: "13:00" },
        ],
      },
    },
    timing: timing(at("2026-09-03", "12:00")),
  }).endsAt?.getTime(),
  at("2026-09-03", "13:00").getTime(),
);

// Multiple equally eligible ranges are ambiguous and never selected arbitrarily.
assert.equal(
  resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", dateEnd: "2026-09-05", startTime: "12:00", endTime: "14:00" },
          { date: "2026-09-02", dateEnd: "2026-09-06", startTime: "12:00", endTime: "15:00" },
        ],
      },
    },
    timing: timing(at("2026-09-03", "12:00")),
  }).endsAt,
  null,
);

// An overnight range occurrence ends on the next local date.
{
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", dateEnd: "2026-09-05", startTime: "20:00", endTime: "02:00" },
        ],
      },
    },
    timing: timing(at("2026-09-03", "20:00")),
  });
  assert.equal(result.endsAt?.getTime(), at("2026-09-04", "02:00").getTime());
}

// Overnight endTime resolves to the following local calendar day.
{
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: {
        scheduleItems: [
          { date: "2026-09-01", startTime: "20:00", endTime: "02:00", allDay: false },
        ],
      },
    },
    timing: timing(at("2026-09-01", "20:00")),
  });
  assert.equal(result.endsAt?.getTime(), at("2026-09-02", "02:00").getTime());
  assert.equal(result.durationMinutes, 360);
}

// Imported range is accepted only when its start is the selected occurrence exactly.
{
  const start = at("2026-09-01", "15:00");
  const end = at("2026-09-01", "17:00");
  const result = resolveScenarioScheduling({
    activity: {
      schedulingKind: "SLOT",
      scheduleJson: { startAt: start.toISOString(), endAt: end.toISOString() },
    },
    timing: timing(start),
  });
  assert.equal(result.endsAt?.getTime(), end.getTime());
}

// Existing scenario-time capability is exposed only for genuinely flexible items.
assert.equal(
  resolveScenarioScheduling({
    activity: { schedulingKind: "WINDOW", scheduleJson: null },
    timing: timing(at("2026-09-01", "10:00"), true),
  }).canReschedule,
  true,
);
assert.equal(
  resolveScenarioScheduling({
    activity: { schedulingKind: "SLOT", scheduleJson: null },
    timing: timing(at("2026-09-01", "10:00")),
  }).canReschedule,
  false,
);
assert.equal(
  resolveScenarioScheduling({
    activity: { schedulingKind: null, scheduleJson: null },
    timing: timing(at("2026-09-01", "10:00"), true),
  }).canReschedule,
  false,
  "UNKNOWN remains conservative even when the item has an override-capable time source",
);

console.log("scenarioScheduling tests: OK");

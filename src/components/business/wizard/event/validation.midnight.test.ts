import assert from "node:assert/strict";

import { getDefaultFormData, createDefaultScheduleItem } from "./defaults";
import { validateStep } from "./validation";
import type { EventFormData } from "./types";

function withSchedule(overrides: Partial<EventFormData["scheduleItems"][number]>): EventFormData {
  const data = getDefaultFormData();
  const item = { ...createDefaultScheduleItem(), date: "2026-08-22", ...overrides };
  data.dates = [item.date as string];
  data.scheduleItems = [item];
  data.allDay = item.allDay;
  data.startTime = item.startTime;
  data.endTime = item.endTime;
  return data;
}

function hasTimeOrderError(data: EventFormData): boolean {
  const result = validateStep(5, data);
  return result.errors.some((e) => e.includes("Время окончания"));
}

// 1. 12:00 -> 18:00: no time-order error
{
  const data = withSchedule({ startTime: "12:00", endTime: "18:00" });
  assert.equal(hasTimeOrderError(data), false);
}

// 2. 20:00 -> 02:00: crosses midnight, no error (this was the reported bug)
{
  const data = withSchedule({ startTime: "20:00", endTime: "02:00" });
  assert.equal(hasTimeOrderError(data), false);
}

// 3. 23:30 -> 00:30: crosses midnight, no error
{
  const data = withSchedule({ startTime: "23:30", endTime: "00:30" });
  assert.equal(hasTimeOrderError(data), false);
}

// 4. 00:30 -> 02:00: same day, no error
{
  const data = withSchedule({ startTime: "00:30", endTime: "02:00" });
  assert.equal(hasTimeOrderError(data), false);
}

// 5. 12:00 -> 12:00: still an error (not treated as 24h)
{
  const data = withSchedule({ startTime: "12:00", endTime: "12:00" });
  assert.equal(hasTimeOrderError(data), true);
}

// 6. Весь день: time-order check is skipped entirely regardless of times
{
  const data = withSchedule({ allDay: true, startTime: "20:00", endTime: "02:00" });
  assert.equal(hasTimeOrderError(data), false);
}

// 7. Multi-day with explicit distinct startDate/endDate: built from
// date+startTime and dateEnd+endTime, not an automatic extra day.
{
  const data = withSchedule({
    isMultiDay: true,
    date: "2026-08-22",
    dateEnd: "2026-08-24",
    startTime: "20:00",
    endTime: "02:00",
  });
  assert.equal(hasTimeOrderError(data), false);
}

// 8. Multiple date cards are each validated independently.
{
  const data = getDefaultFormData();
  const good = { ...createDefaultScheduleItem("a"), date: "2026-08-22", startTime: "20:00", endTime: "02:00" };
  const bad = { ...createDefaultScheduleItem("b"), date: "2026-08-23", startTime: "12:00", endTime: "12:00" };
  data.dates = ["2026-08-22", "2026-08-23"];
  data.scheduleItems = [good, bad];
  assert.equal(hasTimeOrderError(data), true);
}

// Explicit SLOT cannot be saved incomplete, while WINDOW/legacy UNKNOWN are
// not reclassified or blocked by the SLOT-only completeness contract.
{
  const slot = withSchedule({ startTime: "12:00", endTime: "" });
  slot.schedulingKind = "SLOT";
  assert.ok(validateStep(5, slot).errors.some((error) => error.includes("события в конкретное время")));

  const window = { ...slot, schedulingKind: "WINDOW" as const };
  assert.ok(!validateStep(5, window).errors.some((error) => error.includes("события в конкретное время")));

  const unknown = { ...slot, schedulingKind: null };
  assert.ok(!validateStep(5, unknown).errors.some((error) => error.includes("события в конкретное время")));
}

console.log("validation.midnight tests: OK");

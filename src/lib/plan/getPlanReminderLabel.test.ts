import assert from "node:assert/strict";

import {
  getPlanReminderLabel,
  parsePlanDateTimeInTz,
  PLAN_REMINDER_LABELS,
} from "./getPlanReminderLabel";

const tz = "Europe/Minsk";

function label(now: string, event: string) {
  return getPlanReminderLabel({
    now: parsePlanDateTimeInTz(now.split(" ")[0]!, now.split(" ")[1]!, tz),
    eventDateTime: parsePlanDateTimeInTz(event.split(" ")[0]!, event.split(" ")[1]!, tz),
    timeZone: tz,
  });
}

assert.equal(
  label("2026-06-09 12:00", "2026-06-10 15:00"),
  PLAN_REMINDER_LABELS.eveningBefore,
  "tomorrow afternoon, before 18:00",
);

assert.equal(
  label("2026-06-09 23:30", "2026-06-10 15:00"),
  PLAN_REMINDER_LABELS.tomorrowMorning,
  "tomorrow afternoon, after 18:00",
);

assert.equal(
  label("2026-06-09 20:00", "2026-06-10 09:00"),
  PLAN_REMINDER_LABELS.tonight,
  "tomorrow morning, before 21:00",
);

assert.equal(
  label("2026-06-09 22:30", "2026-06-10 09:00"),
  PLAN_REMINDER_LABELS.tomorrowMorning,
  "tomorrow morning, after 21:00",
);

assert.equal(
  label("2026-06-10 12:00", "2026-06-10 15:00"),
  PLAN_REMINDER_LABELS.twoHoursBefore,
  "same day, more than 2 hours",
);

assert.equal(
  label("2026-06-10 13:00", "2026-06-10 15:00"),
  PLAN_REMINDER_LABELS.startingSoon,
  "same day, exactly 2 hours",
);

assert.equal(
  label("2026-06-10 14:30", "2026-06-10 15:00"),
  PLAN_REMINDER_LABELS.startingSoon,
  "same day, within 2 hours",
);

assert.equal(
  label("2026-06-09 12:00", "2026-06-12 15:00"),
  PLAN_REMINDER_LABELS.eveningBefore,
  "two or more days ahead",
);

assert.equal(
  getPlanReminderLabel({
    now: parsePlanDateTimeInTz("2026-06-10", "16:00", tz),
    eventDateTime: parsePlanDateTimeInTz("2026-06-10", "15:00", tz),
    timeZone: tz,
  }),
  null,
  "past event hides reminder line",
);

console.log("getPlanReminderLabel tests: OK");

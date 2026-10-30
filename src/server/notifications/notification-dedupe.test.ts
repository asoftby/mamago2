import assert from "node:assert/strict";

import { buildNotificationDedupeKeyCore, buildPlanReminderEventId } from "./notification-dedupe-core";

{
  const key = buildNotificationDedupeKeyCore({
    scenario: "PLAN_EVENT_2H_BEFORE",
    userId: "user_42",
    eventId: "event_77",
  });

  assert.equal(key, "PLAN_EVENT_2H_BEFORE:user_42:event_77");
}

{
  const key = buildNotificationDedupeKeyCore({
    scenario: "PLAN_TOMORROW_DIGEST",
    userId: "user_42",
    eventId: "2026-05-15",
  });

  assert.equal(key, "PLAN_TOMORROW_DIGEST:user_42:2026-05-15");
}

console.log("notification-dedupe tests: OK");

{
  const startsAt = new Date("2026-11-01T14:00:00.000Z");
  const early = new Date("2026-11-01T12:00:00.000Z");
  const moved = new Date("2026-11-01T13:00:00.000Z");
  const first = buildPlanReminderEventId({ planItemId: "plan_a", startsAt, reminderDueAt: early });
  assert.equal(first, "plan_a:2026-11-01T12:00:00.000Z");
  assert.equal(buildPlanReminderEventId({ planItemId: "plan_a", startsAt, reminderDueAt: early }), first);
  assert.notEqual(buildPlanReminderEventId({ planItemId: "plan_a", startsAt, reminderDueAt: moved }), first);
  assert.notEqual(buildPlanReminderEventId({ planItemId: "plan_b", startsAt, reminderDueAt: early }), first);
}

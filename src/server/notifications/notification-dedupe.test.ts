import assert from "node:assert/strict";

import { buildNotificationDedupeKeyCore } from "./notification-dedupe-core";

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

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

console.log("notification-dedupe tests: OK");

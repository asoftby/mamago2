import assert from "node:assert/strict";

import { computeEventScheduleResyncPlan } from "./computeEventScheduleResyncPlan";

function testNoopWhenDatesMatch() {
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-09"], startTime: "11:00" },
    currentSessions: [{ startsAt: new Date(2026, 7, 9, 11, 0) }],
  });
  assert.equal(plan.action, "NOOP_ALREADY_SYNCED");
  assert.equal(plan.desiredFingerprint, plan.actualFingerprint);
  assert.equal(plan.desiredSessionCount, 1);
  assert.equal(plan.actualSessionCount, 1);
}

function testResyncWhenDatesDiffer() {
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-09"], startTime: "11:00" },
    currentSessions: [{ startsAt: new Date(2026, 6, 20, 11, 0) }],
  });
  assert.equal(plan.action, "RESYNC");
  assert.notEqual(plan.desiredFingerprint, plan.actualFingerprint);
}

function testResyncWhenStoredSessionsAreStaleSuperset() {
  // Mirrors the real 2026-07-28 incident: source now resolves to fewer,
  // pruned future dates than what's still materialized from over a week ago.
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: { mode: "MULTI_DATE", dates: ["2026-07-28", "2026-08-01"], startTime: "12:00" },
    currentSessions: [
      { startsAt: new Date(2026, 5, 14, 12, 0) },
      { startsAt: new Date(2026, 5, 26, 12, 0) },
      { startsAt: new Date(2026, 6, 20, 12, 0) },
      { startsAt: new Date(2026, 6, 28, 12, 0) },
      { startsAt: new Date(2026, 7, 1, 12, 0) },
    ],
  });
  assert.equal(plan.action, "RESYNC");
  assert.equal(plan.desiredSessionCount, 2);
  assert.equal(plan.actualSessionCount, 5);
}

function testBlockedExpiredSourceWhenScheduleDraftNull() {
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: null,
    currentSessions: [{ startsAt: new Date(2026, 6, 25, 16, 0) }],
    blockedReason: "EVENT_PAST_ONLY_EXCLUDED",
  });
  assert.equal(plan.action, "BLOCKED_EXPIRED_SOURCE");
  assert.equal(plan.blockedReason, "EVENT_PAST_ONLY_EXCLUDED");
  assert.equal(plan.desiredSessionCount, 0);
  assert.equal(plan.actualSessionCount, 1);
}

function testDesiredSessionCountExpandsScheduleItemRanges() {
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: {
      mode: "MULTI_DATE",
      dates: ["2026-07-28", "2026-08-24"],
      scheduleItems: [{ date: "2026-07-28", dateEnd: "2026-07-30", startTime: "12:00" }],
      startTime: "12:00",
    },
    currentSessions: [],
  });
  // 2026-07-28..2026-07-30 expands to 3 sessions, not the flat 2-entry `dates` array.
  assert.equal(plan.desiredSessionCount, 3);
  assert.equal(plan.action, "RESYNC");
}

function testNoopWithZeroSessionsBothSides() {
  const plan = computeEventScheduleResyncPlan({
    scheduleDraft: { mode: "ONE_TIME", dates: [] },
    currentSessions: [],
  });
  assert.equal(plan.desiredSessionCount, 0);
  assert.equal(plan.actualSessionCount, 0);
  assert.equal(plan.action, "NOOP_ALREADY_SYNCED");
}

async function main() {
  testNoopWhenDatesMatch();
  testResyncWhenDatesDiffer();
  testResyncWhenStoredSessionsAreStaleSuperset();
  testBlockedExpiredSourceWhenScheduleDraftNull();
  testDesiredSessionCountExpandsScheduleItemRanges();
  testNoopWithZeroSessionsBothSides();
  console.log("computeEventScheduleResyncPlan tests: OK");
}

main().catch((error) => {
  console.error("computeEventScheduleResyncPlan tests: FAILED", error);
  process.exitCode = 1;
});

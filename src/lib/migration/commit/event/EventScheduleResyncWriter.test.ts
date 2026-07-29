import assert from "node:assert/strict";

import {
  resyncEventScheduleSessions,
  type EventScheduleResyncTransactionClient,
  type EventScheduleResyncWriterPrismaClient,
} from "./EventScheduleResyncWriter";

type FakeCall = { delegate: "activity" | "activitySession"; method: string; args: unknown };

function createFakeClient(nextUpcomingSession: { startsAt: Date } | null) {
  const calls: FakeCall[] = [];
  const tx: EventScheduleResyncTransactionClient = {
    activity: {
      update: (async (args: unknown) => {
        calls.push({ delegate: "activity", method: "update", args });
        return { id: "activity-1" };
      }) as unknown as EventScheduleResyncTransactionClient["activity"]["update"],
    },
    activitySession: {
      deleteMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "deleteMany", args });
        return { count: 0 };
      }) as unknown as EventScheduleResyncTransactionClient["activitySession"]["deleteMany"],
      createMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "createMany", args });
        return { count: (args as { data?: unknown[] }).data?.length ?? 0 };
      }) as unknown as EventScheduleResyncTransactionClient["activitySession"]["createMany"],
      findFirst: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "findFirst", args });
        return nextUpcomingSession;
      }) as unknown as EventScheduleResyncTransactionClient["activitySession"]["findFirst"],
      findMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "findMany", args });
        return [];
      }) as unknown as EventScheduleResyncTransactionClient["activitySession"]["findMany"],
    },
  };
  const client: EventScheduleResyncWriterPrismaClient = {
    $transaction: async (fn) => fn(tx),
  };
  return { client, calls };
}

async function testWritesSessionsAndNextOccurrence() {
  const nextStartsAt = new Date("2026-08-09T11:00:00.000Z");
  const { client, calls } = createFakeClient({ startsAt: nextStartsAt });

  const result = await resyncEventScheduleSessions(client, {
    activityId: "activity-1",
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-09"], startTime: "11:00" },
  });

  assert.equal(result.activityId, "activity-1");
  assert.equal(result.sessionsWritten, 1);
  assert.equal(result.nextOccurrenceAt, nextStartsAt);
  assert.ok(calls.some((c) => c.delegate === "activitySession" && c.method === "deleteMany"));
  assert.ok(calls.some((c) => c.delegate === "activitySession" && c.method === "createMany"));
}

/**
 * The transaction client type has no general `data` bag on `activity.update`
 * beyond `nextOccurrenceAt` — this asserts the *actual call shape* stays
 * that narrow at runtime too, not just at the type level.
 */
async function testOnlyWritesNextOccurrenceAtOnActivity() {
  const { client, calls } = createFakeClient(null);
  await resyncEventScheduleSessions(client, {
    activityId: "activity-1",
    scheduleDraft: { mode: "ONE_TIME", dates: ["2020-01-01"] },
  });

  const activityUpdateCalls = calls.filter((c) => c.delegate === "activity" && c.method === "update");
  assert.equal(activityUpdateCalls.length, 1);
  const data = (activityUpdateCalls[0].args as { data: Record<string, unknown> }).data;
  assert.deepEqual(Object.keys(data), ["nextOccurrenceAt"]);
}

async function testMultiDateExpandsRanges() {
  const { client, calls } = createFakeClient(null);
  await resyncEventScheduleSessions(client, {
    activityId: "activity-1",
    scheduleDraft: {
      mode: "MULTI_DATE",
      dates: ["2026-07-28", "2026-08-24"],
      scheduleItems: [{ date: "2026-07-28", dateEnd: "2026-07-30", startTime: "12:00" }],
      startTime: "12:00",
    },
  });

  const createManyCall = calls.find((c) => c.delegate === "activitySession" && c.method === "createMany");
  assert.ok(createManyCall);
  const data = (createManyCall!.args as { data: unknown[] }).data;
  assert.equal(data.length, 3);
}

async function main() {
  await testWritesSessionsAndNextOccurrence();
  await testOnlyWritesNextOccurrenceAtOnActivity();
  await testMultiDateExpandsRanges();
  console.log("EventScheduleResyncWriter tests: OK");
}

main().catch((error) => {
  console.error("EventScheduleResyncWriter tests: FAILED", error);
  process.exitCode = 1;
});

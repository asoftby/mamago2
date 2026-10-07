import assert from "node:assert/strict";
import type {
  PlanItemReminderContext,
  SendNotificationResult,
} from "@/lib/notifications/domainContracts";
import type { PlanReminderCandidate } from "@/server/services/plan.service";
import { runPlanEventRemindersCore } from "./run-plan-event-reminders-core";

function candidate(
  userId: string,
  startsAt: Date | null,
  options: { reminderAt?: Date | null; activityId?: string | null; title?: string } = {},
): PlanReminderCandidate {
  return {
    id: `plan_${userId}`,
    userId,
    activityId: options.activityId === undefined ? `activity_${userId}` : options.activityId,
    date: "2026-08-27",
    startsAt,
    reminderAt: options.reminderAt ?? null,
    title: options.title ?? "Событие",
    coverImageUrl: null,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    activity: null,
  };
}

const sentResult = {
  status: "SENT",
  notificationId: "n1",
  prepared: {} as never,
  deliveries: [],
} satisfies SendNotificationResult;

void (async () => {
  {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const sends: Array<{ userId: string; timeZone?: string }> = [];
    const result = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async () => [
          candidate("u30", new Date("2026-08-27T12:30:00.000Z")),
          candidate("u120", new Date("2026-08-27T14:00:00.000Z")),
          candidate("uLater", new Date("2026-08-27T15:00:00.000Z")),
          candidate("disabled", new Date("2026-08-27T14:00:00.000Z")),
        ],
        getReminderSettingsForUsersFn: async () =>
          new Map([
            ["u30", { enabled: true, offsetMinutes: 30, timeZone: "Europe/Minsk" }],
            ["u120", { enabled: true, offsetMinutes: 120, timeZone: "Europe/Amsterdam" }],
            ["uLater", { enabled: true, offsetMinutes: 120, timeZone: "Europe/Minsk" }],
            ["disabled", { enabled: false, offsetMinutes: 120, timeZone: "Europe/Minsk" }],
          ]),
        sendNotificationFn: async (input) => {
          sends.push({ userId: input.userId, timeZone: input.context.timeZone });
          return sentResult;
        },
      },
    );

    assert.equal(result.candidatesFound, 4);
    assert.equal(result.dueCandidates, 2);
    assert.equal(result.skippedSchedule, 2);
    assert.equal(result.sent, 2);
    assert.deepEqual(sends, [
      { userId: "u30", timeZone: "Europe/Minsk" },
      { userId: "u120", timeZone: "Europe/Amsterdam" },
    ]);
  }

  {
    const now = new Date("2026-08-27T12:00:00.000Z");
    let sent = false;
    const result = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async () => [
          candidate("admin", new Date("2026-08-27T12:05:00.000Z")),
        ],
        getReminderSettingsForUsersFn: async () =>
          new Map([
            ["admin", { enabled: true, offsetMinutes: 5, timeZone: "Europe/Minsk" }],
          ]),
        sendNotificationFn: async () => {
          sent = true;
          return sentResult;
        },
      },
    );
    assert.equal(sent, true);
    assert.equal(result.results[0]?.offsetMinutes, 5);
  }

  {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const reminderAt = new Date("2026-08-27T11:55:00.000Z");
    let scenario = "";
    const result = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async () => [
          candidate("manual", null, {
            reminderAt,
            activityId: null,
            title: "Взять справку в школу",
          }),
        ],
        getReminderSettingsForUsersFn: async () =>
          new Map([
            ["manual", { enabled: true, offsetMinutes: 120, timeZone: "Europe/Minsk" }],
          ]),
        sendNotificationFn: async (input) => {
          scenario = input.scenario;
          assert.equal(input.scenario, "PLAN_ITEM_REMINDER");
          if (input.scenario === "PLAN_ITEM_REMINDER") {
            const context = input.context as PlanItemReminderContext;
            assert.equal(context.itemTitle, "Взять справку в школу");
            assert.equal(context.reminderAt.toISOString(), reminderAt.toISOString());
          }
          return sentResult;
        },
      },
    );
    assert.equal(scenario, "PLAN_ITEM_REMINDER");
    assert.equal(result.dueCandidates, 1);
    assert.equal(result.sent, 1);
    assert.equal(result.results[0]?.offsetMinutes, null);
    assert.equal(result.results[0]?.reminderAt, reminderAt.toISOString());
  }

  console.log("run-plan-event-reminders tests: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

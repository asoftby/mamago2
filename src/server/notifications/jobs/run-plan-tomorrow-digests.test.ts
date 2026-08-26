import assert from "node:assert/strict";
import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import type { PlanTomorrowDigestCandidate } from "@/server/services/plan.service";
import { runPlanTomorrowDigestsCore } from "./run-plan-tomorrow-digests-core";

const now = new Date("2026-10-24T21:30:00.000Z");

function item(userId: string, id: string, startsAt: Date | null): PlanTomorrowDigestCandidate {
  return {
    id,
    userId,
    activityId: null,
    routeId: null,
    placeId: null,
    articleId: null,
    planRouteSlug: null,
    planPlaceSlug: null,
    date: userId === "minsk" ? "2026-10-26" : "2026-10-25",
    startsAt,
    title: id,
    coverImageUrl: null,
    createdAt: new Date(`2026-10-20T00:0${id.at(-1) ?? "0"}:00.000Z`),
    activity: null,
  } as PlanTomorrowDigestCandidate;
}

const sent: SendNotificationResult = {
  status: "SENT",
  notificationId: "notification",
  prepared: {} as never,
  deliveries: [],
};

void (async () => {
  const targets: Array<{ userId: string; date: string }> = [];
  const advances: string[] = [];
  const sends: Array<{ userId: string; ids: string[]; timeZone: string }> = [];
  const result = await runPlanTomorrowDigestsCore(
    { now },
    {
      listDueSchedulesFn: async () => [
        { userId: "minsk", timeZone: "Europe/Minsk", planEveningNextRunAt: now },
        { userId: "amsterdam", timeZone: "Europe/Amsterdam", planEveningNextRunAt: now },
        { userId: "empty", timeZone: "Europe/Amsterdam", planEveningNextRunAt: now },
      ],
      listPlanItemsForUserDatesFn: async (input) => {
        targets.push(...input);
        return [
          item("minsk", "item_3", null),
          item("minsk", "item_2", new Date("2026-10-26T12:00:00.000Z")),
          item("minsk", "item_1", new Date("2026-10-26T08:00:00.000Z")),
          item("amsterdam", "item_4", new Date("2026-10-25T08:00:00.000Z")),
        ];
      },
      advanceScheduleFn: async (userId) => { advances.push(userId); },
      sendNotificationFn: async (input) => {
        sends.push({
          userId: input.userId,
          ids: input.context.items.map((entry) => entry.planItemId),
          timeZone: input.context.timeZone,
        });
        return sent;
      },
    },
  );

  assert.deepEqual(targets, [
    { userId: "minsk", date: "2026-10-26" },
    { userId: "amsterdam", date: "2026-10-25" },
    { userId: "empty", date: "2026-10-25" },
  ]);
  assert.deepEqual(sends, [
    { userId: "minsk", ids: ["item_1", "item_2", "item_3"], timeZone: "Europe/Minsk" },
    { userId: "amsterdam", ids: ["item_4"], timeZone: "Europe/Amsterdam" },
  ]);
  assert.deepEqual(advances, ["minsk", "amsterdam", "empty"]);
  assert.equal(result.messagesSent, 2);
  assert.equal(result.planItemsIncluded, 4);
  assert.equal(result.skippedEmptyPlan, 1);

  const duplicate = await runPlanTomorrowDigestsCore(
    { now },
    {
      listDueSchedulesFn: async () => [
        { userId: "minsk", timeZone: "Europe/Minsk", planEveningNextRunAt: now },
      ],
      listPlanItemsForUserDatesFn: async () => [item("minsk", "item_1", now)],
      advanceScheduleFn: async () => undefined,
      sendNotificationFn: async (input) => ({
        status: "SKIPPED",
        notificationId: null,
        prepared: { scenario: input.scenario, userId: input.userId, context: input.context, dedupeKey: "digest", shouldSend: false, skipReason: "DUPLICATE_ALREADY_SENT", content: { title: "", body: "", ctaLabel: null, ctaUrl: null } },
        deliveries: [],
        reason: "DUPLICATE_ALREADY_SENT",
      }),
    },
  );
  assert.equal(duplicate.skippedDuplicate, 1);
  assert.equal(duplicate.messagesSent, 0);

  console.log("run-plan-tomorrow-digests tests: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

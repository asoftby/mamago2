import assert from "node:assert/strict";

import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import { runPlanEventRemindersCore } from "./run-plan-event-reminders-core";

const now = new Date("2026-04-24T13:00:00+03:00");

void (async () => {
  {
    const result = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async ({ windowStart, windowEnd }) => {
          assert.equal(windowStart.toISOString(), "2026-04-24T11:50:00.000Z");
          assert.equal(windowEnd.toISOString(), "2026-04-24T12:10:00.000Z");

          return [
            {
              id: "plan_1",
              userId: "user_1",
              activityId: "event_1",
              routeId: null,
              planRouteSlug: null,
              date: "2026-04-24",
              startsAt: new Date("2026-04-24T12:00:00.000Z"),
              title: "Мастер-класс",
              coverImageUrl: null,
              createdAt: new Date("2026-04-24T09:00:00.000Z"),
              activity: {
                id: "event_1",
                slug: "master-klass",
                title: "Мастер-класс",
                type: "EVENT",
                coverImageUrl: null,
                ageLabel: "5-7",
                eventCategory: null,
                priceFrom: null,
                priceText: null,
                currency: null,
                status: "PUBLISHED",
                owner: null,
                place: {
                  shortAddress: "ул. Ленина, 1",
                  formattedAddr: null,
                  customAddress: null,
                  city: { name: "Минск" },
                },
                venue: null,
                scheduleJson: null,
              },
            },
          ];
        },
        sendNotificationFn: async (input): Promise<SendNotificationResult> => {
          assert.equal(input.scenario, "PLAN_EVENT_2H_BEFORE");
          assert.equal(input.userId, "user_1");
          assert.equal(input.context.activityId, "event_1");
          assert.equal(input.context.eventTitle, "Мастер-класс");
          assert.equal(input.context.placeName, "ул. Ленина, 1");
          assert.equal(input.context.cityName, "Минск");

          return {
            status: "SENT",
            notificationId: "notif_1",
            prepared: {
              scenario: "PLAN_EVENT_2H_BEFORE",
              userId: "user_1",
              dedupeKey: "PLAN_EVENT_2H_BEFORE:user_1:event_1",
              content: {
                title: "Скоро событие",
                body: "В 15:00 у вас в плане: Мастер-класс",
                ctaLabel: "Открыть план",
                ctaUrl: "/me/day/2026-04-24",
              },
              context: input.context,
              shouldSend: true,
              skipReason: null,
            },
            deliveries: [],
          } satisfies SendNotificationResult;
        },
      },
    );

    assert.equal(result.candidatesFound, 1);
    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);
  }

  {
    let sendCalls = 0;

    const firstRun = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async () => [
          {
            id: "plan_2",
            userId: "user_2",
            activityId: "event_2",
            routeId: null,
            planRouteSlug: null,
            date: "2026-04-24",
            startsAt: new Date("2026-04-24T12:00:00.000Z"),
            title: "Концерт",
            coverImageUrl: null,
            createdAt: new Date("2026-04-24T09:00:00.000Z"),
            activity: null,
          },
        ],
        sendNotificationFn: async (_input): Promise<SendNotificationResult> => {
          sendCalls += 1;
          return {
            status: sendCalls === 1 ? "SENT" : "SKIPPED",
            notificationId: sendCalls === 1 ? "notif_2" : null,
            prepared: {
              scenario: "PLAN_EVENT_2H_BEFORE",
              userId: "user_2",
              dedupeKey: "PLAN_EVENT_2H_BEFORE:user_2:event_2",
              content: {
                title: "Скоро событие",
                body: "В 15:00 у вас в плане: Концерт",
                ctaLabel: "Открыть план",
                ctaUrl: "/me/day/2026-04-24",
              },
              context: {
                planItemId: "plan_2",
                activityId: "event_2",
                eventTitle: "Концерт",
                startsAt: new Date("2026-04-24T12:00:00.000Z"),
                placeName: null,
                cityName: null,
              },
              shouldSend: sendCalls === 1,
              skipReason: sendCalls === 1 ? null : "DUPLICATE_ALREADY_SENT",
            },
            deliveries: [],
            ...(sendCalls === 1 ? {} : { reason: "DUPLICATE_ALREADY_SENT" as const }),
          } as SendNotificationResult;
        },
      },
    );

    const secondRun = await runPlanEventRemindersCore(
      { now },
      {
        listPlanItemsDueForReminderFn: async () => [
          {
            id: "plan_2",
            userId: "user_2",
            activityId: "event_2",
            routeId: null,
            planRouteSlug: null,
            date: "2026-04-24",
            startsAt: new Date("2026-04-24T12:00:00.000Z"),
            title: "Концерт",
            coverImageUrl: null,
            createdAt: new Date("2026-04-24T09:00:00.000Z"),
            activity: null,
          },
        ],
        sendNotificationFn: async (_input): Promise<SendNotificationResult> => {
          sendCalls += 1;
          return {
            status: "SKIPPED",
            notificationId: null,
            prepared: {
              scenario: "PLAN_EVENT_2H_BEFORE",
              userId: "user_2",
              dedupeKey: "PLAN_EVENT_2H_BEFORE:user_2:event_2",
              content: {
                title: "Скоро событие",
                body: "В 15:00 у вас в плане: Концерт",
                ctaLabel: "Открыть план",
                ctaUrl: "/me/day/2026-04-24",
              },
              context: {
                planItemId: "plan_2",
                activityId: "event_2",
                eventTitle: "Концерт",
                startsAt: new Date("2026-04-24T12:00:00.000Z"),
                placeName: null,
                cityName: null,
              },
              shouldSend: false,
              skipReason: "DUPLICATE_ALREADY_SENT",
            },
            deliveries: [],
            reason: "DUPLICATE_ALREADY_SENT",
          } satisfies SendNotificationResult;
        },
      },
    );

    assert.equal(firstRun.sent, 1);
    assert.equal(secondRun.skipped, 1);
  }

  console.log("run-plan-event-reminders tests: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

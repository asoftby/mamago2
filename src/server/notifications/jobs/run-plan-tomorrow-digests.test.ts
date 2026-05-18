import assert from "node:assert/strict";

import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import { runPlanTomorrowDigestsCore } from "./run-plan-tomorrow-digests-core";

const now = new Date("2026-05-14T07:00:00.000Z");

void (async () => {
  {
    let sendCalls = 0;

    const result = await runPlanTomorrowDigestsCore(
      { now },
      {
        listPlanItemsForTomorrowDigestFn: async ({ date }) => {
          assert.equal(date, "2026-05-15");
          return [
            {
              id: "plan_1",
              userId: "user_1",
              activityId: "activity_1",
              routeId: null,
              planRouteSlug: null,
              date: "2026-05-15",
              startsAt: new Date("2026-05-15T08:00:00.000Z"),
              title: "Детский спектакль",
              coverImageUrl: null,
              createdAt: new Date("2026-05-10T09:00:00.000Z"),
              activity: {
                id: "activity_1",
                slug: "show",
                title: "Детский спектакль",
                type: "EVENT",
                coverImageUrl: null,
                ageLabel: null,
                eventCategory: null,
                priceFrom: null,
                priceText: null,
                currency: null,
                status: "PUBLISHED",
                owner: null,
                place: {
                  shortAddress: "Театр кукол",
                  formattedAddr: null,
                  customAddress: null,
                  city: { name: "Минск" },
                },
                venue: null,
                scheduleJson: null,
              },
            },
            {
              id: "plan_2",
              userId: "user_1",
              activityId: "activity_2",
              routeId: null,
              planRouteSlug: null,
              date: "2026-05-15",
              startsAt: null,
              title: "Мастер-класс",
              coverImageUrl: null,
              createdAt: new Date("2026-05-10T10:00:00.000Z"),
              activity: null,
            },
          ];
        },
        getTelegramConnectionFn: async () => ({
          isActive: true,
          telegramChatId: "chat_1",
        }),
        getChannelPreferencesFn: async () => ({
          IN_APP: true,
          EMAIL: false,
          TELEGRAM: true,
        }),
        sendNotificationFn: async (input): Promise<SendNotificationResult> => {
          sendCalls += 1;
          assert.equal(input.scenario, "PLAN_TOMORROW_DIGEST");
          assert.equal(input.userId, "user_1");
          assert.equal(input.context.items.length, 2);
          assert.equal(input.context.items[0]?.eventTitle, "Детский спектакль");
          assert.equal(input.context.items[1]?.eventTitle, "Мастер-класс");

          return {
            status: "SENT",
            notificationId: "notif_1",
            prepared: {
              scenario: "PLAN_TOMORROW_DIGEST",
              userId: "user_1",
              dedupeKey: "PLAN_TOMORROW_DIGEST:user_1:2026-05-15",
              content: {
                title: "Завтра в плане",
                body: "digest",
                ctaLabel: "Открыть мой план",
                ctaUrl: "/me/plan",
              },
              context: input.context,
              shouldSend: true,
              skipReason: null,
            },
            deliveries: [
              {
                channel: "IN_APP",
                status: "SENT",
                deliveryId: "delivery_in_app",
              },
              {
                channel: "TELEGRAM",
                status: "SENT",
                deliveryId: "delivery_tg",
              },
            ],
          };
        },
      },
    );

    assert.equal(sendCalls, 1);
    assert.equal(result.usersProcessed, 1);
    assert.equal(result.messagesSent, 1);
    assert.equal(result.planItemsIncluded, 2);
  }

  {
    let sendCalls = 0;

    const result = await runPlanTomorrowDigestsCore(
      { now },
      {
        listPlanItemsForTomorrowDigestFn: async () => [
          {
            id: "plan_3",
            userId: "user_2",
            activityId: "activity_3",
            routeId: null,
            planRouteSlug: null,
            date: "2026-05-15",
            startsAt: new Date("2026-05-15T12:00:00.000Z"),
            title: "Концерт",
            coverImageUrl: null,
            createdAt: new Date("2026-05-10T10:00:00.000Z"),
            activity: null,
          },
        ],
        getTelegramConnectionFn: async () => null,
        getChannelPreferencesFn: async () => ({
          IN_APP: true,
          EMAIL: false,
          TELEGRAM: true,
        }),
        sendNotificationFn: async (): Promise<SendNotificationResult> => {
          sendCalls += 1;
          throw new Error("should not send");
        },
      },
    );

    assert.equal(sendCalls, 0);
    assert.equal(result.skippedNoTelegram, 1);
  }

  {
    const result = await runPlanTomorrowDigestsCore(
      { now },
      {
        listPlanItemsForTomorrowDigestFn: async () => [
          {
            id: "plan_4",
            userId: "user_3",
            activityId: "activity_4",
            routeId: null,
            planRouteSlug: null,
            date: "2026-05-15",
            startsAt: new Date("2026-05-15T12:00:00.000Z"),
            title: "Экскурсия",
            coverImageUrl: null,
            createdAt: new Date("2026-05-10T10:00:00.000Z"),
            activity: null,
          },
        ],
        getTelegramConnectionFn: async () => ({
          isActive: true,
          telegramChatId: "chat_3",
        }),
        getChannelPreferencesFn: async () => ({
          IN_APP: true,
          EMAIL: false,
          TELEGRAM: true,
        }),
        sendNotificationFn: async (input): Promise<SendNotificationResult> => ({
          status: "SKIPPED",
          notificationId: null,
          prepared: {
            scenario: "PLAN_TOMORROW_DIGEST",
            userId: "user_3",
            dedupeKey: "PLAN_TOMORROW_DIGEST:user_3:2026-05-15",
            content: {
              title: "Завтра в плане",
              body: "digest",
              ctaLabel: "Открыть мой план",
              ctaUrl: "/me/plan",
            },
            context: input.context,
            shouldSend: false,
            skipReason: "DUPLICATE_ALREADY_SENT",
          },
          deliveries: [],
          reason: "DUPLICATE_ALREADY_SENT",
        }),
      },
    );

    assert.equal(result.skippedDuplicate, 1);
    assert.equal(result.messagesSent, 0);
  }

  console.log("run-plan-tomorrow-digests tests: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

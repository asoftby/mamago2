import assert from "node:assert/strict";

import type {
  NotificationChannelPreferenceMatrix,
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
  SendNotificationInput,
} from "@/lib/notifications/domainContracts";
import {
  resolveExternalChannelChoiceCore,
  sendNotificationCore,
} from "./notification-service-core";

const baseInput: SendNotificationInput = {
  scenario: "PLAN_EVENT_2H_BEFORE",
  userId: "user_1",
  context: {
    planItemId: "plan_1",
    activityId: "event_1",
    eventTitle: "Семейный концерт",
    startsAt: new Date("2026-04-24T15:00:00+03:00"),
    placeName: "Филармония",
    cityName: "Минск",
  },
};

const prepared: PreparedNotificationPayload = {
  scenario: "PLAN_EVENT_2H_BEFORE",
  userId: "user_1",
  dedupeKey: "PLAN_EVENT_2H_BEFORE:user_1:event_1",
  content: {
    title: "Скоро событие",
    body: "В 15:00 у вас в плане: Семейный концерт",
    ctaLabel: "Открыть план",
    ctaUrl: "/me/day/2026-04-24",
  },
  context: baseInput.context,
  shouldSend: true,
  skipReason: null,
};

function baseDeps(params: {
  preferences: NotificationChannelPreferenceMatrix;
  telegramConnection?: { isActive?: boolean; telegramChatId?: string } | null;
}) {
  const events: string[] = [];

  return {
    events,
    deps: {
      prepareNotificationFn: async () => prepared,
      getChannelPreferencesFn: async () => params.preferences,
      sendInAppNotificationFn: async () => {
        events.push("in-app");
        return {
          notificationId: "notif_1",
          deliveryId: "delivery_in_app",
          outcome: {
            channel: "IN_APP",
            status: "SENT",
            deliveryId: "delivery_in_app",
          } satisfies NotificationDeliveryOutcome,
        };
      },
      skipInAppNotificationFn: async () => {
        events.push("skip-in-app");
        return {
          channel: "IN_APP",
          status: "SKIPPED",
          deliveryId: "delivery_in_app_skipped",
          errorMessage: "USER_DISABLED_CHANNEL",
        } satisfies NotificationDeliveryOutcome;
      },
      findUserFn: async () => ({ id: "user_1", email: "user@example.com" }),
      getTelegramConnectionFn: async () => params.telegramConnection ?? null,
      sendTelegramNotificationFn: async (_params: {
        userId: string;
        notificationId: string | null;
        telegramChatId: string;
        prepared: PreparedNotificationPayload;
      }) => {
        events.push("telegram");
        return {
          channel: "TELEGRAM",
          status: "SENT",
          deliveryId: "delivery_tg",
        } satisfies NotificationDeliveryOutcome;
      },
      skipTelegramNotificationFn: async ({
        reason,
      }: {
        userId: string;
        notificationId?: string | null;
        prepared: PreparedNotificationPayload;
        reason: "USER_DISABLED_CHANNEL" | "CHANNEL_NOT_CONNECTED";
      }) => {
        events.push(`skip-telegram:${reason}`);
        return {
          channel: "TELEGRAM",
          status: "SKIPPED",
          deliveryId: "delivery_tg_skipped",
          errorMessage: reason,
        } satisfies NotificationDeliveryOutcome;
      },
      sendEmailNotificationFn: async (_params: {
        userId: string;
        notificationId: string | null;
        email: string | null | undefined;
        prepared: PreparedNotificationPayload;
      }) => {
        events.push("email");
        return {
          channel: "EMAIL",
          status: "SENT",
          deliveryId: "delivery_email",
        } satisfies NotificationDeliveryOutcome;
      },
      skipEmailNotificationFn: async ({
        reason,
      }: {
        userId: string;
        notificationId?: string | null;
        prepared: PreparedNotificationPayload;
        reason: "USER_DISABLED_CHANNEL";
      }) => {
        events.push(`skip-email:${reason}`);
        return {
          channel: "EMAIL",
          status: "SKIPPED",
          deliveryId: "delivery_email_skipped",
          errorMessage: reason,
        } satisfies NotificationDeliveryOutcome;
      },
    },
  };
}

{
  assert.equal(
    resolveExternalChannelChoiceCore({
      preferences: { IN_APP: true, EMAIL: true, TELEGRAM: true },
      telegramConnected: true,
    }),
    "TELEGRAM",
  );
  assert.equal(
    resolveExternalChannelChoiceCore({
      preferences: { IN_APP: true, EMAIL: true, TELEGRAM: false },
      telegramConnected: false,
    }),
    "EMAIL",
  );
  assert.equal(
    resolveExternalChannelChoiceCore({
      preferences: { IN_APP: true, EMAIL: false, TELEGRAM: true },
      telegramConnected: false,
    }),
    null,
  );
}

void (async () => {
  {
    const { events, deps } = baseDeps({
      preferences: { IN_APP: true, EMAIL: true, TELEGRAM: true },
      telegramConnection: { isActive: true, telegramChatId: "chat_1" },
    });

    const result = await sendNotificationCore(baseInput, deps);

    assert.equal(result.status, "SENT");
    assert.equal(result.notificationId, "notif_1");
    assert.deepEqual(events, ["in-app", "telegram"]);
    assert.equal(result.deliveries[1]?.channel, "TELEGRAM");
  }

  {
    const { events, deps } = baseDeps({
      preferences: { IN_APP: true, EMAIL: true, TELEGRAM: false },
      telegramConnection: null,
    });

    const result = await sendNotificationCore(baseInput, deps);

    assert.equal(result.status, "SENT");
    assert.deepEqual(events, ["in-app", "skip-telegram:USER_DISABLED_CHANNEL", "email"]);
    assert.equal(result.deliveries[1]?.status, "SKIPPED");
    assert.equal(result.deliveries[2]?.channel, "EMAIL");
  }

  {
    const { events, deps } = baseDeps({
      preferences: { IN_APP: true, EMAIL: true, TELEGRAM: true },
      telegramConnection: null,
    });

    const result = await sendNotificationCore(baseInput, deps);

    assert.equal(result.status, "SENT");
    assert.deepEqual(events, ["in-app", "skip-telegram:CHANNEL_NOT_CONNECTED", "email"]);
    assert.equal(result.deliveries[1]?.errorMessage, "CHANNEL_NOT_CONNECTED");
    assert.equal(result.deliveries[2]?.channel, "EMAIL");
  }

  {
    const { events, deps } = baseDeps({
      preferences: { IN_APP: false, EMAIL: false, TELEGRAM: false },
      telegramConnection: null,
    });

    const result = await sendNotificationCore(baseInput, deps);

    assert.equal(result.status, "SENT");
    assert.equal(result.notificationId, null);
    assert.deepEqual(events, [
      "skip-in-app",
      "skip-telegram:USER_DISABLED_CHANNEL",
      "skip-email:USER_DISABLED_CHANNEL",
    ]);
    assert.equal(result.deliveries.every((item) => item.status === "SKIPPED"), true);
  }

  {
    const skipped = await sendNotificationCore(baseInput, {
      ...baseDeps({
        preferences: { IN_APP: true, EMAIL: true, TELEGRAM: true },
        telegramConnection: null,
      }).deps,
      prepareNotificationFn: async () => ({
        ...prepared,
        shouldSend: false,
        skipReason: "DUPLICATE_ALREADY_SENT",
      }),
    });

    assert.equal(skipped.status, "SKIPPED");
    assert.equal(skipped.reason, "DUPLICATE_ALREADY_SENT");
    assert.equal(skipped.deliveries.length, 0);
  }

  console.log("notification-service tests: OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

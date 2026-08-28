import assert from "node:assert/strict";
import test from "node:test";
import { NotificationType } from "@prisma/client";
import { initializeTelegramPlanNotificationPreferences } from "./telegramNotificationBootstrap.service";

test("initializes plan Telegram preferences without overwriting existing rows", async () => {
  let received: unknown = null;
  const store = {
    async createMany(args: unknown) {
      received = args;
      return { count: 2 };
    },
  };

  const count = await initializeTelegramPlanNotificationPreferences("user-1", store as never);

  assert.equal(count, 2);
  assert.deepEqual(received, {
    data: [
      {
        userId: "user-1",
        audience: "USER",
        notificationType: NotificationType.REMINDER,
        inAppEnabled: null,
        emailEnabled: null,
        telegramEnabled: true,
      },
      {
        userId: "user-1",
        audience: "USER",
        notificationType: NotificationType.PLAN_TOMORROW_DIGEST,
        inAppEnabled: null,
        emailEnabled: null,
        telegramEnabled: true,
      },
    ],
    skipDuplicates: true,
  });
});

test("returns zero when both explicit preferences already exist", async () => {
  const store = {
    async createMany(args: { skipDuplicates: boolean }) {
      assert.equal(args.skipDuplicates, true);
      return { count: 0 };
    },
  };

  const count = await initializeTelegramPlanNotificationPreferences("user-2", store as never);
  assert.equal(count, 0);
});

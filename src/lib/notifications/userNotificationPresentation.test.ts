import assert from "node:assert/strict";

import {
  getUserNotificationMatrixDefinitions,
  wouldDisableLastSystemNotificationChannel,
} from "./userNotificationPresentation";

{
  assert.deepEqual(
    getUserNotificationMatrixDefinitions().map((item) => item.title),
    ["План", "Рекомендации", "Новое и интересное", "Аккаунт"],
  );
}

{
  assert.equal(
    wouldDisableLastSystemNotificationChannel({
      notificationType: "SYSTEM",
      channels: { IN_APP: true, EMAIL: false, TELEGRAM: false },
      channel: "IN_APP",
      enabled: false,
    }),
    true,
  );

  assert.equal(
    wouldDisableLastSystemNotificationChannel({
      notificationType: "SYSTEM",
      channels: { IN_APP: true, EMAIL: true, TELEGRAM: false },
      channel: "IN_APP",
      enabled: false,
    }),
    false,
  );

  assert.equal(
    wouldDisableLastSystemNotificationChannel({
      notificationType: "REMINDER",
      channels: { IN_APP: true, EMAIL: false, TELEGRAM: true },
      channel: "IN_APP",
      enabled: false,
    }),
    false,
  );
}

console.log("userNotificationPresentation tests: OK");

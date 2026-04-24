import assert from "node:assert/strict";

import { wouldDisableLastSystemNotificationChannel } from "./userNotificationPresentation";

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

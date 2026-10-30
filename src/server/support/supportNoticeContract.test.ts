import assert from "node:assert/strict";
import test from "node:test";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/notificationRegistry";

test("support notifications are separate from Direct and routed to correct surfaces", () => {
  const business = NOTIFICATION_REGISTRY.SUPPORT_BUSINESS_REPLY;
  const staff = NOTIFICATION_REGISTRY.SUPPORT_STAFF_MESSAGE;
  assert.equal(business.surface, "BUSINESS");
  assert.equal(business.audience, "BUSINESS");
  assert.equal(business.defaultChannels.inApp, true);
  assert.equal(business.defaultChannels.telegram, true, "business Telegram is opt-in through existing connection");
  assert.equal(business.defaultChannels.email, false);
  assert.equal(business.resolveHref?.({}), "/business/support");
  assert.equal(staff.surface, "ADMIN");
  assert.equal(staff.audience, "ADMIN");
  assert.equal(staff.defaultChannels.inApp, true);
  assert.equal(staff.defaultChannels.telegram, false, "never send staff notices to a family Telegram bot");
  assert.equal(staff.resolveHref?.({}), "/admin/support");
});

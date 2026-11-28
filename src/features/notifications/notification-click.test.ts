import assert from "node:assert/strict";
import { test } from "node:test";
import { handleNotificationClick } from "./notification-click";
import type { NotificationApiRow } from "@/lib/notifications/types";

test("CTA persists read before navigation and a failed resolve preserves the unread row", async () => {
  const original = globalThis.fetch;
  const events: string[] = [];
  const notification = { id: "synthetic-notice" } as NotificationApiRow;
  const params = {
    notification,
    router: { push: () => events.push("navigate") } as unknown as Parameters<typeof handleNotificationClick>[0]["router"],
    onAfterRead: () => events.push("remove-from-bell"),
    onClose: () => events.push("close"),
  };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/notifications/synthetic-notice/resolve-action");
      assert.equal(options?.method, "POST");
      events.push("persist-read");
      return Response.json({ notificationId: notification.id, actionMode: "PAGE", actionUrl: "/business/bookings" });
    };
    await handleNotificationClick(params);
    assert.deepEqual(events, ["persist-read", "remove-from-bell", "navigate", "close"]);
    events.length = 0;
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(handleNotificationClick(params));
    assert.deepEqual(events, []);
  } finally { globalThis.fetch = original; }
});

import assert from "node:assert/strict";
import type { Notification } from "@prisma/client";
import { getNotificationRegistryEntry } from "./notificationRegistry";
import { getNotificationSurfaceDefaults } from "./settingsDomain";
import { resolveNotificationProductDomain } from "./productDomains";
import { renderNotificationTelegramMessage } from "@/server/services/telegram/TelegramTemplateRenderer";

// Direct business notices: registered for the business surface, e-mail off, Telegram on by default.
for (const type of ["DIRECT_THREAD_CREATED", "DIRECT_CLIENT_WAITING"] as const) {
  const entry = getNotificationRegistryEntry(type);
  assert.ok(entry, `${type} must be registered`);
  assert.equal(entry.audience, "BUSINESS");
  assert.equal(entry.surface, "BUSINESS");
  assert.equal(getNotificationSurfaceDefaults("BUSINESS", type).email, false, `${type}: e-mail is opt-in`);
  assert.equal(getNotificationSurfaceDefaults("BUSINESS", type).telegram, true, `${type}: Telegram on by default`);
  assert.equal(
    entry.resolveHref?.({ entityId: "thr_1" }),
    "/business/direct/thr_1",
    `${type}: opens the dialog in the business cabinet`,
  );
}

// The "waiting" ping is external-only: its in-app twin (DIRECT_NEW_MESSAGE) already sits in the bell.
assert.equal(getNotificationSurfaceDefaults("BUSINESS", "DIRECT_CLIENT_WAITING").inApp, false);
assert.equal(getNotificationSurfaceDefaults("BUSINESS", "DIRECT_THREAD_CREATED").inApp, true);

// DIRECT_NEW_MESSAGE must stay UNREGISTERED: it is also sent to parents, and registering it
// would switch on e-mail/Telegram for them.
assert.ok(!getNotificationRegistryEntry("DIRECT_NEW_MESSAGE"));
assert.deepEqual(getNotificationSurfaceDefaults("USER", "DIRECT_NEW_MESSAGE"), { inApp: false, email: false, telegram: false });

// Telegram text carries no customer identity and no message text, only thread number + a button.
const waiting = {
  id: "n1", userId: "u1", type: "DIRECT_CLIENT_WAITING", audience: "BUSINESS",
  title: "Клиент ждёт ответа в D-10035", body: "Откройте диалог в кабинете, чтобы ответить.",
  entityType: "DIRECT_THREAD", entityId: "thr_1", ctaLabel: "Открыть диалог", ctaAction: "/business/direct/thr_1",
  metadata: null, actionUrl: null,
} as unknown as Notification;
const rendered = renderNotificationTelegramMessage(waiting);
assert.match(rendered.text, /D-10035/);
assert.doesNotMatch(rendered.text, /Анна|Катя|http/i, "no customer name or link text leaks into the message body");
const buttons = JSON.stringify(rendered.replyMarkup ?? {});
assert.match(buttons, /\/business\/direct\/thr_1/, "the button deep-links to the dialog");

// Domain badge: business-audience Direct notices are BUSINESS, personal ones stay generic.
assert.equal(resolveNotificationProductDomain({ type: "DIRECT_NEW_MESSAGE", audience: "BUSINESS", title: "x", body: "y" }), "BUSINESS");
assert.notEqual(resolveNotificationProductDomain({ type: "DIRECT_NEW_MESSAGE", audience: "USER", title: "x", body: "y" }), "BUSINESS");

console.log("directBusinessNotices.test.ts: OK");

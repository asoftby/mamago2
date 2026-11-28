import assert from "node:assert/strict";
import { test } from "node:test";
import type { Notification } from "@prisma/client";
import { renderNotificationTelegramMessage } from "./TelegramTemplateRenderer";
import { getSafeTelegramReturnPath } from "@/lib/telegram/webAppButton";

const base = {
  id: "synthetic-notice", userId: "synthetic-user", type: "SYSTEM", audience: "USER",
  title: "Освободилось место", body: "Ответьте на предложение организатора.",
  ctaLabel: "Ответить", ctaAction: "/booking-reoffers/synthetic-invite",
  actionUrl: "/booking-reoffers/synthetic-invite", metadata: { source: "BOOKING_REOFFER" },
} as unknown as Notification;

test("reoffer Telegram button preserves consent destination through the signed Mini App launcher", () => {
  const previous = process.env.APP_PUBLIC_URL;
  process.env.APP_PUBLIC_URL = "https://dev.mamago.by";
  try {
    const rendered = renderNotificationTelegramMessage(base);
    const button = rendered.replyMarkup?.inline_keyboard[0][0];
    assert.equal(button?.text, "Ответить");
    assert.ok(button?.web_app?.url);
    const launcher = new URL(button.web_app.url);
    assert.equal(launcher.origin, "https://dev.mamago.by");
    assert.equal(launcher.pathname, "/telegram/open");
    assert.equal(launcher.searchParams.get("next"), base.actionUrl);
    assert.equal(getSafeTelegramReturnPath(launcher.searchParams.get("next")), base.actionUrl);
    assert.doesNotMatch(JSON.stringify(rendered), /synthetic-user|\/settings/);
    // Ordinary SYSTEM notices retain the existing settings destination.
    const ordinary = renderNotificationTelegramMessage({ ...base, metadata: null });
    assert.equal(ordinary.replyMarkup?.inline_keyboard[0][0].text, "Настройки");
    const url = ordinary.replyMarkup?.inline_keyboard[0][0].web_app?.url;
    assert.ok(url);
    assert.equal(new URL(url).searchParams.get("next"), "/settings");
    for (const unsafe of ["https://evil.example", "//evil.example", "/booking-reoffers/id?next=https://evil.example", "/api/booking-reoffers/id"]) {
      assert.equal(renderNotificationTelegramMessage({ ...base, actionUrl: unsafe, ctaAction: unsafe }).replyMarkup, undefined);
    }
  } finally {
    if (previous === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = previous;
  }
});

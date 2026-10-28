import assert from "node:assert/strict";
import test from "node:test";
import { NOTIFICATION_REGISTRY } from "@/lib/notifications/notificationRegistry";
import { createTelegramLinkButton, getSafeTelegramReturnPath } from "./webAppButton";

test("explicit Mini App intent launches signed Telegram auth with original destination", () => {
  assert.deepEqual(createTelegramLinkButton(
    "Открыть план", "https://dev.mamago.by/me/plan?date=2026-10-15", "https://dev.mamago.by", "mini_app",
  ), {
    text: "Открыть план",
    web_app: { url: "https://dev.mamago.by/telegram/open?next=%2Fme%2Fplan%3Fdate%3D2026-10-15" },
  });
});

test("browser intent keeps a shareable canonical URL and adds first-party Telegram attribution", () => {
  assert.deepEqual(createTelegramLinkButton(
    "Читать", "https://mamago.by/minsk/blog/article?sort=recent#gallery", "https://mamago.by",
    "browser", "notification_news",
  ), {
    text: "Читать",
    url: "https://mamago.by/minsk/blog/article?sort=recent&utm_source=telegram&utm_medium=bot&utm_campaign=notification_news#gallery",
  });
});

test("browser intent respects existing campaign attribution rather than overwriting it", () => {
  assert.deepEqual(createTelegramLinkButton(
    "Событие", "https://mamago.by/minsk/events/demo?utm_source=partner&utm_campaign=original",
    "https://mamago.by", "browser", "notification_news",
  ), {
    text: "Событие",
    url: "https://mamago.by/minsk/events/demo?utm_source=partner&utm_campaign=original&utm_medium=bot",
  });
});

test("external URLs, non-HTTPS and unsafe Mini App targets are never rewritten", () => {
  assert.deepEqual(createTelegramLinkButton(
    "Read", "https://other.example/a", "https://mamago.by", "browser",
  ), { text: "Read", url: "https://other.example/a" });
  assert.deepEqual(createTelegramLinkButton(
    "Read", "https://other.example/a", "https://mamago.by", "mini_app",
  ), { text: "Read", url: "https://other.example/a" });
  assert.deepEqual(createTelegramLinkButton(
    "Plan", "/me/plan", "http://localhost:3000", "mini_app",
  ), { text: "Plan", url: "/me/plan" });
  assert.deepEqual(createTelegramLinkButton(
    "Read", "javascript:alert(1)", "https://mamago.by", "browser",
  ), { text: "Read", url: "javascript:alert(1)" });
});

test("malicious and auth-loop next targets never redirect outside mamaGo", () => {
  for (const next of [
    "//attacker.example", "/\\attacker.example", "/%5cattacker.example",
    "https://attacker.example", "/api/auth/logout", "/telegram/open",
    "/login", "/%2f%2fattacker.example",
  ]) {
    assert.equal(getSafeTelegramReturnPath(next), "/me/plan", next);
  }
  assert.equal(getSafeTelegramReturnPath("/me/plan?date=2026-10-15"), "/me/plan?date=2026-10-15");
});

test("notification registry declares Mini App ONLY for explicitly personal user destinations", () => {
  for (const type of [
    "SYSTEM", "REMINDER", "PLAN_TOMORROW_DIGEST",
    "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_COMPLETED", "BOOKING_FEEDBACK_REQUEST",
  ]) {
    assert.equal(NOTIFICATION_REGISTRY[type]?.telegramOpenIntent, "mini_app", type);
    assert.equal(NOTIFICATION_REGISTRY[type]?.audience, "USER", type);
  }

  for (const type of [
    "WELCOME", "NEWS", "ANNOUNCEMENT", "PLACE_APPROVED",
    "ACTIVITY_APPROVED", "OFFER_APPROVED", "BUSINESS_VERIFIED",
    "BOOKING_CREATED", "BOOKING_STALE", "BOOKING_NEEDS_ATTENTION",
    "ADMIN_MODERATION_ITEM_CREATED",
  ]) {
    assert.notEqual(NOTIFICATION_REGISTRY[type]?.telegramOpenIntent, "mini_app", type);
  }
});

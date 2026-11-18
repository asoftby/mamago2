import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildPrivateBusinessBookingNotification, buildPrivateBusinessBookingReminder, businessBookingDeliveryProjection } from "./businessBookingNotificationPrivacy";

const personal = {
  customerName: "SUPER_SECRET_PARENT",
  childName: "SUPER_SECRET_CHILD",
  childAge: 9,
};

test("BUSINESS push text and persisted metadata contain no family identity", () => {
  for (const publication of [
    { offerId: "offer-1", offerTitle: "Танцы" },
    { activityId: "event-1", activityTitle: "Мастер-класс" },
    { placeId: "place-1", placeTitle: "Кафе" },
    { campShiftId: "shift-1", campShiftTitle: "Июльская смена",
      campShiftDateFrom: "2026-07-01", campShiftDateTo: "2026-07-10" },
  ]) {
    const result = buildPrivateBusinessBookingNotification({ ...publication, ...personal });
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(personal.customerName), false);
    assert.equal(serialized.includes(personal.childName), false);
    assert.equal(serialized.includes(String(personal.childAge) + " лет"), false);
    assert.equal(result.templatePayload.actor, "Клиент");
    assert.equal(result.templatePayload.customerName, "Клиент");
    assert.equal("childName" in result.templatePayload, false);
    assert.equal("childAge" in result.templatePayload, false);
    assert.match(result.body, /Клиент/);
  }
});

test("public booking context remains visible while sensitive caller inputs are ignored", () => {
  const first = buildPrivateBusinessBookingNotification({
    activityId: "evt", activityTitle: "Спектакль",
    customerName: "Первый родитель", childName: "Тая", childAge: 5,
  });
  const second = buildPrivateBusinessBookingNotification({
    activityId: "evt", activityTitle: "Спектакль",
    customerName: "Второй родитель", childName: "Стёпа", childAge: 8,
  });
  assert.deepEqual(first, second, "No customer-identifying data should affect push content");
  assert.match(first.body, /Спектакль/);
});

test("both stale reminder types contain no identity and preserve the Russian time labels", () => {
  const matrix = [
    ["BOOKING_STALE", 24, "Новая заявка ждёт ответа уже 24 часа"],
    ["BOOKING_STALE", 49, "Новая заявка ждёт ответа уже 2 дня"],
    ["BOOKING_NEEDS_ATTENTION", 72, "Подтверждённая заявка без активности 3 дня"],
  ] as const;
  for (const [type, hours, expected] of matrix) {
    assert.equal(buildPrivateBusinessBookingReminder(type, hours), expected);
  }
});

test("legacy business notices are sanitized before email/Telegram dispatch or retry", () => {
  for (const type of ["BOOKING_CREATED", "BOOKING_STALE", "BOOKING_NEEDS_ATTENTION"]) {
    const legacy = {
      audience: "BUSINESS", type, title: "Имя: SECRET_PARENT",
      body: "SECRET_PARENT, SECRET_CHILD, +375291234567",
      metadata: { templatePayload: { actor: "SECRET_CHILD", customerName: "SECRET_PARENT", phone: "+375291234567" } },
      entityId: "booking-42", ctaAction: "/business/bookings?request=booking-42",
    };
    const safe = businessBookingDeliveryProjection(legacy);
    assert.equal(JSON.stringify(safe).includes("SECRET_PARENT"), false);
    assert.equal(JSON.stringify(safe).includes("SECRET_CHILD"), false);
    assert.equal(JSON.stringify(safe).includes("+375291234567"), false);
    assert.equal(safe.metadata, null);
    assert.equal(safe.entityId, legacy.entityId);
    assert.equal(safe.ctaAction, legacy.ctaAction);
    assert.notEqual(safe, legacy, "Must not mutate the persisted notification object");
  }
});

test("business privacy delivery layer never rewrites customer or non-booking notifications", () => {
  for (const notice of [
    { audience: "USER", type: "BOOKING_CREATED", title: "Личное", body: "Уведомление", metadata: null },
    { audience: "BUSINESS", type: "DIRECT_NEW_MESSAGE", title: "Диалог", body: "Новый ответ", metadata: null },
  ]) {
    assert.equal(businessBookingDeliveryProjection(notice), notice);
  }
});

test("Party Outbox BOOKING_CREATED keeps signed-confirmation routing metadata", () => {
  const partyNotice = {
    audience: "BUSINESS",
    type: "BOOKING_CREATED",
    title: "Новая заявка на праздник",
    body: "Новая заявка на «Аниматор» — ответьте в разделе «Праздники».",
    metadata: {
      source: "PARTY_OUTBOX",
      outboxId: "outbox-1",
      templatePayload: { actor: "Семья", customerName: "Семья", offerTitle: "Аниматор" },
    },
  };
  assert.equal(businessBookingDeliveryProjection(partyNotice), partyNotice,
    "Party keyboard must still see PARTY_OUTBOX and outboxId");
});

test("manual email resend enforces the same legacy notice projection as automatic delivery", () => {
  const source = readFileSync("src/server/services/notificationDelivery.service.ts", "utf8");
  const resend = source.slice(source.indexOf("export async function resendNotificationDelivery("));
  assert.ok(resend.length > 1000);
  assert.match(resend, /const safe = businessBookingDeliveryProjection\(delivery\.notification\)/);
  assert.match(resend, /buildNotificationEmailTemplate\(\s*safe\.type as NotificationType,\s*safe\.title,\s*safe\.body,/);
});

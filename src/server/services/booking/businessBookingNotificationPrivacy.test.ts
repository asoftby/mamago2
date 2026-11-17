import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrivateBusinessBookingNotification } from "./businessBookingNotificationPrivacy";

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

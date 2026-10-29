import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  asMinutes, asTime, emptyUnitForm, fromUnitDetail, toUnitPayload,
} from "./bookingUnitForm";

assert.equal(asMinutes("10:30"), 630);
assert.equal(asMinutes("24:00"), -1, "HTML wall clock cannot be 24:00");
assert.equal(asMinutes("garbage"), -1);
assert.equal(asTime(0), "00:00");
assert.equal(asTime(1439), "23:59");
assert.equal(asTime(1440), "24:00", "end-of-day boundary must not be silently rounded");
const blank = emptyUnitForm();
assert.equal(blank.rules.length, 5);
assert.deepEqual(blank.rules.map(r => r.weekday), [1, 2, 3, 4, 5]);
assert.equal(blank.status, "ACTIVE");
assert.equal(blank.exceptions.length, 0);
const created = toUnitPayload({ ...blank, name: "Комната", capacity: "20", offerIds: ["o1"] });
assert.equal(created.capacity, 20);
assert.equal(created.prepMinutes, 0);
assert.ok(!("status" in created), "POST must not send edit-only fields");
const detail = {
  id: "u1", name: "Room", status: "INACTIVE" as const,
  updatedAt: "2026-10-28T13:00:00.000Z", timezone: "Europe/Minsk",
  capacity: null, prepMinutes: 10, cleanupMinutes: 5,
  minDurationMinutes: null, stepMinutes: 30,
  offers: [{ offerId: "o2" }],
  rules: [{ weekday: 7, startMinutes: 600, endMinutes: 1440 }],
  exceptions: [{ date: "2026-11-15T00:00:00.000Z", kind: "CLOSED" as const, startMinutes: null, endMinutes: null }],
};
const hydrated = fromUnitDetail(detail);
assert.equal(hydrated.expectedUpdatedAt, detail.updatedAt);
assert.equal(hydrated.exceptions[0].date, "2026-11-15");
assert.equal(hydrated.rules[0].endMinutes, 1440);
const edited = toUnitPayload(hydrated);
assert.equal(edited.status, "INACTIVE");
assert.equal(edited.exceptions?.[0].kind, "CLOSED");

const ui = readFileSync("src/components/business/booking-units/BookingUnitManager.tsx", "utf8");
const page = readFileSync("src/app/business/(protected)/booking-units/page.tsx", "utf8");
const navigation = readFileSync("src/lib/business/navigation.ts", "utf8");
for (const guard of [
  'getJson<{ unit: UnitDetail }>',
  'method: id ? "PUT" : "POST"',
  'toUnitPayload(form)',
  'type="date"',
  'checked={rule.endMinutes === 1440}',
  'checked={exception.endMinutes === 1440}',
  'type="checkbox"',
  'await reload()',
]) assert.ok(ui.includes(guard), "Missing functional UI element: " + guard);
assert.ok(page.includes('place: { ownerBusinessId: business.id }'), "offer choices must be business-scoped");
assert.ok(page.includes('"PARTY_SERVICE", "PARTY_PACKAGE"'), "must only offer birthday products");
assert.ok(navigation.includes('label: "Ресурсы и расписание"'), "the page must be discoverable from business sidebar");
assert.ok(navigation.includes('BUSINESS_BOOKING_UNITS_HREF'), "the route must be declared in business navigation");
console.log("bookingUnitForm.test.ts: OK");

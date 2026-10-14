import assert from "node:assert/strict";
import { offerOperationalVersion } from "./offerOperationalVersion";

const base = {
  priceFrom: 50,
  priceTo: 50,
  priceMode: "EXACT",
  priceItems: null,
  priceText: null,
  campSessions: [{ id: "s1", dateFrom: "2026-06-03", priceOverride: "550" }],
  contactPhone: "+375291112233",
  title: "Название",
  updatedAt: new Date("2026-01-01"),
};

const v = offerOperationalVersion(base);
assert.match(v, /^[0-9a-f]{16}$/);

// фоновые правки (updatedAt, slug, текст) версию не меняют
assert.equal(offerOperationalVersion({ ...base, updatedAt: new Date("2026-02-02"), slug: "x", title: "Другое" }), v);
// Decimal-подобное значение и число равны
assert.equal(offerOperationalVersion({ ...base, priceFrom: { toNumber: () => 50 } }), v);
// пустое = пустое
assert.equal(offerOperationalVersion({ ...base, priceText: "" }), v);

// чужая правка цены / телефона / смен меняет версию
assert.notEqual(offerOperationalVersion({ ...base, priceFrom: 60 }), v);
assert.notEqual(offerOperationalVersion({ ...base, contactPhone: "+375291119999" }), v);
assert.notEqual(offerOperationalVersion({ ...base, campSessions: [{ id: "s1", dateFrom: "2026-06-03", priceOverride: "600" }] }), v);

console.log("offerOperationalVersion tests passed");

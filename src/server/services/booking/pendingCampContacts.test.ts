import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolvePendingCampContacts } from "./pendingCampContacts";

const common = {
  contactSource: "manual", offerPhone: null, offerBookingPhone: null,
  offerWebsite: null, offerInstagram: null,
  placePhone: "+375 29 123 45 67",
  placeWebsite: "https://example.by",
  placeInstagram: "https://instagram.com/example",
};

assert.deepEqual(resolvePendingCampContacts(common), {
  phone: null, website: null, instagram: null,
}, "manual contacts cannot leak Place fallbacks");
assert.deepEqual(resolvePendingCampContacts({ ...common, contactSource: "place" }), {
  phone: common.placePhone, website: common.placeWebsite,
  instagram: common.placeInstagram,
}, "explicit Place inheritance exposes only the chosen public source");
assert.deepEqual(resolvePendingCampContacts({
  ...common, contactSource: "place", offerPhone: "+375 29 999 99 99",
  offerWebsite: "https://offer.example.by", offerInstagram: "https://instagram.com/offer",
}), {
  phone: "+375 29 999 99 99", website: "https://offer.example.by",
  instagram: "https://instagram.com/offer",
}, "manual override has priority over inherited Place data");
assert.equal(resolvePendingCampContacts({
  ...common, contactSource: "manual", offerBookingPhone: "+375 29 111 11 11",
}).phone, "+375 29 111 11 11");

const bookingService = readFileSync(
  new URL("./parentBookings.service.ts", import.meta.url), "utf8",
);
assert.match(bookingService, /contactSource: true/);
assert.match(bookingService, /pendingCamp \? resolvePendingCampContacts\(/);
assert.match(bookingService, /placePhone: raw\.offer\?\.place\?\.phone/);
assert.match(bookingService, /\? pendingCampContacts\?\.phone \?\? null/);
console.log("Pending camp contacts: explicit Offer/Place sources only — OK");

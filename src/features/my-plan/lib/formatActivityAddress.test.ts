import assert from "node:assert/strict";
import { formatActivityAddressLine } from "./formatActivityAddress";

assert.equal(formatActivityAddressLine(null), null, "no activity -> no address");

assert.equal(
  formatActivityAddressLine({
    place: {
      shortAddress: "пр-т Машерова, 15/1",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
  }),
  "Минск, пр-т Машерова, 15/1",
  "city + street from place.shortAddress",
);

assert.equal(
  formatActivityAddressLine({
    place: null,
    venue: { addressLine: "ул. Мстиславца, 22", place: { shortAddress: null, formattedAddr: null, customAddress: null, city: { name: "Минск" } } },
  }),
  "Минск, ул. Мстиславца, 22",
  "falls back to venue.addressLine + venue.place.city when no direct place",
);

assert.equal(
  formatActivityAddressLine({
    place: { shortAddress: null, formattedAddr: null, customAddress: null, city: null },
    venue: null,
  }),
  null,
  "no usable address data anywhere -> null, never a fabricated fallback",
);

assert.equal(
  formatActivityAddressLine({
    place: { shortAddress: null, formattedAddr: "Минская обл., ...", customAddress: null, city: null },
    venue: null,
  }),
  "Минская обл., ...",
  "formattedAddr used only as last resort",
);

console.log("formatActivityAddressLine tests: OK");

import assert from "node:assert/strict";
import { deriveShortAddress, isCoordinatePlaceholderAddress, resolvePlaceAddressLabel as label } from "./placeAddressLabel";

// Human-readable address wins over coordinates.
assert.equal(label({ shortAddress: "Притыцкого", formattedAddr: "Притыцкого 12, Минск", lat: 53.9, lng: 27.5 }), "Притыцкого");
assert.equal(label({ shortAddress: null, formattedAddr: "ул. Ратомская, 7", lat: 53.9, lng: 27.5 }), "ул. Ратомская, 7");

// The production-observed broken value: shortAddress "Координаты:" must not be shown.
assert.equal(
  label({ shortAddress: "Координаты:", formattedAddr: "Координаты: 53.904500, 27.561500", lat: 53.9045, lng: 27.5615 }),
  "Координаты: 53.90450, 27.56150",
);
// Coordinates only in formattedAddr, no numeric lat/lng.
assert.equal(label({ shortAddress: "Координаты:", formattedAddr: "Координаты: 53.9, 27.5" }), "Адрес не указан");
// Readable address next to a broken short one.
assert.equal(label({ shortAddress: "Координаты:", formattedAddr: "Притыцкого 12, Минск", lat: 1, lng: 2 }), "Притыцкого 12, Минск");

// Nothing at all / invalid coordinates.
assert.equal(label({}), "Адрес не указан");
assert.equal(label({ shortAddress: "  ", formattedAddr: "", lat: null, lng: null }), "Адрес не указан");
assert.equal(label({ lat: 95, lng: 27 }), "Адрес не указан", "out-of-range latitude is not a coordinate");
assert.equal(label({ lat: Number.NaN, lng: 27 }), "Адрес не указан");
assert.equal(label({ lat: 0, lng: 0 }), "Координаты: 0.00000, 0.00000", "zero is a valid coordinate");
assert.equal(label({ lat: -33.8688, lng: 151.2093 }), "Координаты: -33.86880, 151.20930");

assert.equal(isCoordinatePlaceholderAddress("Координаты:"), true);
assert.equal(isCoordinatePlaceholderAddress("53.9, 27.5"), true);
assert.equal(isCoordinatePlaceholderAddress("Координатная 5"), false);
assert.equal(isCoordinatePlaceholderAddress("Минск, пр. Независимости 1"), false);

// Short address derivation: coordinate placeholders never become a truncated «Координаты:».
assert.equal(deriveShortAddress("Координаты: 53.904500, 27.561500"), null);
assert.equal(deriveShortAddress("Координаты:"), null);
assert.equal(deriveShortAddress(""), null);
assert.equal(deriveShortAddress(undefined), null);
assert.equal(deriveShortAddress("улица Ратомская, д. 7"), "Ратомская");
assert.equal(deriveShortAddress("Притыцкого 12, Минск"), "Притыцкого");
console.log("placeAddressLabel.test.ts: OK");

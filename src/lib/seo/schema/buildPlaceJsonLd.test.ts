import assert from "node:assert/strict";

import { buildPlaceJsonLd } from "./buildPlaceJsonLd";

const jsonLd = buildPlaceJsonLd({
  canonicalUrl: "https://mamago.by/minsk/places/test-place",
  name: "Test place",
  rating: 4.8,
  reviewCount: 123,
  lat: 53.9,
  lng: 27.56,
  publicBaseUrl: "https://mamago.by",
});

assert.equal(jsonLd["@type"], "Place");
assert.equal(
  Object.prototype.hasOwnProperty.call(jsonLd, "aggregateRating"),
  false,
  "generic Place JSON-LD must not emit aggregateRating: Google review snippets do not support Place as a parent type",
);
assert.deepEqual(jsonLd.geo, {
  "@type": "GeoCoordinates",
  latitude: 53.9,
  longitude: 27.56,
});

console.log("buildPlaceJsonLd tests: OK");

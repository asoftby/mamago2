import assert from "node:assert/strict";
import {
  isGoogleMapsNavigationUrl,
  resolveLocationMapUrl,
} from "./locationMapUrl";

assert.equal(isGoogleMapsNavigationUrl("https://maps.google.com/?q=Минск"), true);
assert.equal(isGoogleMapsNavigationUrl("https://www.google.com/maps/search/?api=1&query=Minsk"), true);
assert.equal(isGoogleMapsNavigationUrl("https://www.google.com/maps/dir/?api=1&destination=Minsk"), true);
assert.equal(
  isGoogleMapsNavigationUrl("https://maps.googleapis.com/maps/api/staticmap?center=53.9,27.56"),
  false,
);

assert.deepEqual(resolveLocationMapUrl("https://maps.google.com/?q=Минск"), {
  navigationUrl: "https://maps.google.com/?q=Минск",
});

assert.deepEqual(resolveLocationMapUrl("https://cdn.example.com/map.png"), {
  mapImageUrl: "https://cdn.example.com/map.png",
});

assert.deepEqual(resolveLocationMapUrl("  "), {});
assert.deepEqual(resolveLocationMapUrl(undefined), {});

console.log("location map URL classification: OK");

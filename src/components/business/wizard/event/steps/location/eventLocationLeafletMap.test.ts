import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildEventLocationLeafletMapHtml,
  EVENT_LOCATION_MAP_CLICK_MESSAGE,
} from "./eventLocationLeafletMap";

const staticHtml = buildEventLocationLeafletMapHtml({ lat: 53.9, lng: 27.56 });
assert.match(staticHtml, /basemaps\.cartocdn\.com/);
assert.match(staticHtml, /setView\(\[53\.9,27\.56\],16\)/);
assert.doesNotMatch(staticHtml, new RegExp(EVENT_LOCATION_MAP_CLICK_MESSAGE));

const interactiveHtml = buildEventLocationLeafletMapHtml({ interactive: true });
assert.match(interactiveHtml, /setView\(\[53\.9045,27\.5615\],12\)/);
assert.match(interactiveHtml, new RegExp(EVENT_LOCATION_MAP_CLICK_MESSAGE));
assert.match(interactiveHtml, /map\.on\('click'/);

const previewSource = readFileSync(new URL("./EventLocationMapPreview.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("./EventLocationMapModal.tsx", import.meta.url), "utf8");

for (const [name, source] of [
  ["preview", previewSource],
  ["modal", modalSource],
] as const) {
  assert.doesNotMatch(
    source,
    /GoogleMapsService|google\.maps|NEXT_PUBLIC_GOOGLE_MAP/,
    `${name} must stay independent of the Google Maps browser API`,
  );
  assert.match(
    source,
    /buildEventLocationLeafletMapHtml/,
    `${name} must render the shared keyless Leaflet map`,
  );
}

console.log("event location Leaflet map contract: OK");

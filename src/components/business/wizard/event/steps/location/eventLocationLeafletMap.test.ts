import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildEventLocationLeafletMapHtml,
  EVENT_LOCATION_MAP_CLICK_MESSAGE,
} from "./eventLocationLeafletMap";

const staticHtml = buildEventLocationLeafletMapHtml({ lat: 53.9, lng: 27.56 });
assert.match(staticHtml, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
assert.match(staticHtml, /OpenStreetMap<\/a> contributors/);
assert.doesNotMatch(staticHtml, /basemaps\.cartocdn\.com|CARTO/i);
assert.match(staticHtml, /setView\(\[53\.9,27\.56\],16\)/);
assert.doesNotMatch(staticHtml, new RegExp(EVENT_LOCATION_MAP_CLICK_MESSAGE));

const interactiveHtml = buildEventLocationLeafletMapHtml({ interactive: true });
assert.match(interactiveHtml, /setView\(\[53\.9045,27\.5615\],12\)/);
assert.match(interactiveHtml, new RegExp(EVENT_LOCATION_MAP_CLICK_MESSAGE));
assert.match(interactiveHtml, /map\.on\('click'/);

const previewSource = readFileSync(new URL("./EventLocationMapPreview.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("./EventLocationMapModal.tsx", import.meta.url), "utf8");
const publicLocationSource = readFileSync(
  new URL("../../../../../shared/LocationBlock.tsx", import.meta.url),
  "utf8",
);

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

assert.match(
  publicLocationSource,
  /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/,
  "public LocationBlock must use the standard OpenStreetMap tile endpoint",
);
assert.doesNotMatch(
  publicLocationSource,
  /basemaps\.cartocdn\.com|CARTO/i,
  "public LocationBlock must not reintroduce CARTO tiles that require an API key",
);
assert.match(
  publicLocationSource,
  /attributionControl:true/,
  "OpenStreetMap attribution must stay visible in the public map",
);
assert.match(
  publicLocationSource,
  /OpenStreetMap<\/a> contributors/,
  "public map must attribute OpenStreetMap contributors",
);

console.log("event/public OpenStreetMap tile contract: OK");

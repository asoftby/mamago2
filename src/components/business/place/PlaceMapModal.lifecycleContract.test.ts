/**
 * Static lifecycle regression for PlaceMapModal.
 *
 * The map instance must not be torn down/recreated when a parent rerender
 * supplies a new onClose callback identity. Reinitializing the map here resets
 * zoom/center after the user has manually positioned the pin.
 *
 * Run: npx tsx src/components/business/place/PlaceMapModal.lifecycleContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/business/place/PlaceMapModal.tsx",
  "utf8",
);

assert.match(
  source,
  /const onCloseRef = useRef\(onClose\);/,
  "PlaceMapModal must keep onClose in a ref so callback identity changes do not reinitialize the map",
);

assert.match(
  source,
  /onCloseRef\.current = onClose;/,
  "PlaceMapModal must refresh the onClose ref when the callback changes",
);

const lifecycleStart = source.indexOf("useEffect(() => {\n    if (!isOpen) {");
assert.notEqual(lifecycleStart, -1, "expected to find the map lifecycle effect");

const lifecycleEnd = source.indexOf("\n\n  useEffect(() => {\n    if (!tempPin", lifecycleStart);
assert.notEqual(lifecycleEnd, -1, "expected to find the end of the map lifecycle effect");

const lifecycle = source.slice(lifecycleStart, lifecycleEnd);

assert.match(
  lifecycle,
  /setTempPin\(initialPin\);\s+void initMap\(initialPin\);/,
  "opening/reopening the modal must reset tempPin from the current initial coordinates before map initialization",
);

assert.match(
  lifecycle,
  /onCloseRef\.current\(\);/,
  "Escape handling must call the latest onClose callback through the ref",
);

assert.match(
  lifecycle,
  /\}, \[isOpen, initialLat, initialLng\]\);/,
  "map lifecycle must depend only on open state and initial coordinates",
);

assert.ok(
  !lifecycle.includes("[isOpen, initialLat, initialLng, onClose]"),
  "onClose callback identity must never be a dependency of map initialization",
);

console.log("PlaceMapModal lifecycle contract: OK");

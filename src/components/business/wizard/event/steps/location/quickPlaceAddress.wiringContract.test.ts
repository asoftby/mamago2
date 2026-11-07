/**
 * Static wiring contract (no jsdom in this harness) for the shared quick-create address picker
 * used by the Breaking News / article editor on mobile.
 * Запуск: npx tsx src/components/business/wizard/event/steps/location/quickPlaceAddress.wiringContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const input = read("./EventLocationSearchInput.tsx");
const quick = read("./QuickPlaceCreate.tsx");
const picker = read("../../../../../admin/articles/ActivityCardEntityPicker.tsx");

// One shared address component: QuickPlaceCreate must not grow its own copy.
assert.match(quick, /import \{ EventLocationSearchInput \} from "\.\/EventLocationSearchInput"/);
assert.match(quick, /<EventLocationSearchInput[\s\S]*?\beagerInit\b/, "widget mounts without the swap-on-focus that drops the mobile keyboard");

// Widget init is lazy by default (no Google Maps cost for other consumers) and eager only on request.
assert.match(input, /eagerInit = false/);
assert.match(input, /useState\(eagerInit && !disabled\)/);

// Typing/selecting never navigates: Enter in the fallback field is swallowed, no router usage.
assert.match(input, /event\.key === "Enter"\) event\.preventDefault\(\)/);
assert.doesNotMatch(input, /useRouter|router\.(push|replace)|window\.location/);
assert.doesNotMatch(quick, /useRouter|router\.(push|replace)|window\.location/);

// Selection keeps coordinates: select handler forwards lat/lng/googlePlaceId to the form.
assert.match(input, /onPlaceSelectRef\.current\(\{[\s\S]*?lat,[\s\S]*?lng,/);
assert.match(quick, /lat: resolvedLocation\.lat,[\s\S]*?lng: resolvedLocation\.lng,/);

// Article place picker: draft is a distinct, non-alarming state; "Место недоступно" only for truly unavailable.
assert.match(picker, /preview\.availability === "draft"/);
assert.match(picker, /Черновик: связь сохранена/);
assert.match(picker, /preview\.availability === "unavailable"/);
// entityType/entityId are never reset by showing a preview.
assert.doesNotMatch(picker, /onChangeId\(""\)/);

console.log("quickPlaceAddress.wiringContract.test.ts: OK");

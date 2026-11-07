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


// Touch targets: both "Подтвердить точку" buttons are at least 44px (min-h-11), Leaflet logic untouched.
const map = read("./EventLocationMapModal.tsx");
const confirmButtons = map.match(/<Button[\s\S]*?Подтвердить точку[\s\S]*?<\/Button>/g) ?? [];
assert.equal(confirmButtons.length, 2, "inline + fullscreen confirm buttons");
for (const b of confirmButtons) assert.match(b, /min-h-11/);
assert.match(map, /EVENT_LOCATION_MAP_CLICK_MESSAGE/);

// Breaking News editor derives every success message from the server status, never from the clicked action.
const editor = read("../../../../../admin/publications/PublicationTypeEditors.tsx");
assert.doesNotMatch(editor, /showBreakingNewsSuccess\("draft_saved"/);
assert.doesNotMatch(editor, /showBreakingNewsSuccess\("published", id, moderatedSnap, true\);\s*\} else \{\s*toast\.success\("Публикация отклонена"\)/);
assert.match(editor, /resolveBreakingNewsOutcome\("save", snap\.status\)/);
assert.match(editor, /resolveBreakingNewsOutcome\("submit", publishedSnap\?\.status, statusBeforeAction\)/);
assert.match(editor, /resolveBreakingNewsOutcome\("publish", moderatedSnap\?\.status, statusBeforeAction\)/);


// Every Place-creating path derives shortAddress through the shared guard.
const placesRoute = read("../../../../../../app/api/business/places/route.ts");
const publishResolver = read("../../../../../../lib/business/resolvePendingLocationOnPublish.ts");
for (const src of [placesRoute, publishResolver]) {
  assert.match(src, /deriveShortAddress\(/);
  assert.doesNotMatch(src, /extractStreetName\(/);
}

console.log("quickPlaceAddress.wiringContract.test.ts: OK");

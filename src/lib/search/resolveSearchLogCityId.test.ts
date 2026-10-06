import assert from "node:assert/strict";
import { pickSearchCityLookup } from "./resolveSearchLogCityId";

assert.deepEqual(pickSearchCityLookup({ citySlug: "minsk" }), {
  kind: "slug",
  slug: "minsk",
});

assert.deepEqual(
  pickSearchCityLookup({ citySlug: "minsk", legacyCityId: "legacy-id" }),
  { kind: "slug", slug: "minsk" },
  "citySlug must win over legacy cityId",
);

assert.deepEqual(pickSearchCityLookup({ legacyCityId: "legacy-id" }), {
  kind: "legacy",
  cityId: "legacy-id",
});

assert.deepEqual(pickSearchCityLookup({ citySlug: "  ", legacyCityId: null }), {
  kind: "none",
});

assert.deepEqual(pickSearchCityLookup({}), { kind: "none" });

console.log("resolveSearchLogCityId pick: PASS");

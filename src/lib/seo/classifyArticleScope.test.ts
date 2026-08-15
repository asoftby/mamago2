import assert from "node:assert/strict";

import { classifyArticleScope } from "./classifyArticleScope";

assert.deepEqual(classifyArticleScope({ geoScope: "COUNTRY", cityId: null }), { scope: "GLOBAL" });
// COUNTRY with a stray cityId (shouldn't happen — DB CHECK constraint
// forbids it — but the classifier must still resolve deterministically
// rather than trust an inconsistent cityId over the explicit geoScope).
assert.deepEqual(classifyArticleScope({ geoScope: "COUNTRY", cityId: "city-minsk" }), { scope: "GLOBAL" });

assert.deepEqual(classifyArticleScope({ geoScope: "CITY", cityId: "city-minsk" }), { scope: "CITY", cityId: "city-minsk" });

// CITY declared but no cityId (shouldn't happen — DB CHECK constraint — but
// never crash, never guess a city).
assert.deepEqual(classifyArticleScope({ geoScope: "CITY", cityId: null }), { scope: "UNKNOWN" });

// The real migrated-Article shape: no editor decision yet.
assert.deepEqual(classifyArticleScope({ geoScope: null, cityId: null }), { scope: "UNKNOWN" });
// geoScope null but a stray cityId present — still UNKNOWN, never inferred as CITY.
assert.deepEqual(classifyArticleScope({ geoScope: null, cityId: "city-minsk" }), { scope: "UNKNOWN" });

console.log("classifyArticleScope tests: OK");

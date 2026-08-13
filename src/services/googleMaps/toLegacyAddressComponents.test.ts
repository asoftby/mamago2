/**
 * Run: npx tsx src/services/googleMaps/toLegacyAddressComponents.test.ts
 */
import assert from "node:assert/strict";
import { toLegacyAddressComponents } from "./toLegacyAddressComponents";

// Maps Places API (New) longText/shortText into the legacy long_name/short_name
// shape that server-side enrichment (extractCityFromAddress, enrich-location API) expects.
const result = toLegacyAddressComponents([
  { longText: "Минск", shortText: "Минск", types: ["locality", "political"] },
  { longText: "Беларусь", shortText: "BY", types: ["country", "political"] },
]);
assert.deepEqual(result, [
  { long_name: "Минск", short_name: "Минск", types: ["locality", "political"] },
  { long_name: "Беларусь", short_name: "BY", types: ["country", "political"] },
]);

// Falls back short_name -> long_name and vice versa when only one is present
assert.deepEqual(toLegacyAddressComponents([{ longText: "Минская область", types: [] }]), [
  { long_name: "Минская область", short_name: "Минская область", types: [] },
]);
assert.deepEqual(toLegacyAddressComponents([{ shortText: "BY", types: ["country"] }]), [
  { long_name: "BY", short_name: "BY", types: ["country"] },
]);

// Missing text fields degrade to empty strings, not undefined/null
assert.deepEqual(toLegacyAddressComponents([{ types: ["route"] }]), [
  { long_name: "", short_name: "", types: ["route"] },
]);

// Non-array input never throws — enrichment always receives a well-formed array
assert.deepEqual(toLegacyAddressComponents(undefined), []);
assert.deepEqual(toLegacyAddressComponents(null), []);

console.log("toLegacyAddressComponents.test.ts: OK");

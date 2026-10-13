import assert from "node:assert/strict";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { MAX_OFFER_INTERESTS, checkInterestSlugs } from "./offerInterests";

assert.equal(MAX_OFFER_INTERESTS, 5);
assert.equal(SYSTEM_INTERESTS.length, 13);

assert.deepEqual(checkInterestSlugs([]), { ok: true, slugs: [] });
assert.deepEqual(checkInterestSlugs(["sport", "music", "sport"]), { ok: true, slugs: ["sport", "music"] });
assert.deepEqual(checkInterestSlugs(["sport", "music", "art", "dance", "animals"]).ok, true);
assert.deepEqual(checkInterestSlugs(["sport", "music", "art", "dance", "animals", "books"]), { ok: false, reason: "TOO_MANY" });
assert.deepEqual(checkInterestSlugs(["sport", "languages"]), { ok: false, reason: "INVALID" });
assert.deepEqual(checkInterestSlugs(["Спорт"]), { ok: false, reason: "INVALID" });
assert.deepEqual(checkInterestSlugs("sport"), { ok: false, reason: "INVALID" });
// все 13 известных slug принимаются по одному
for (const interest of SYSTEM_INTERESTS) {
  assert.deepEqual(checkInterestSlugs([interest.slug]), { ok: true, slugs: [interest.slug] });
}

console.log("offerInterests tests passed");

import assert from "node:assert/strict";
import { restoreHydratedKudaItems } from "./kudaListingPage";
import type { ActivityMock } from "@/types/activity";
const base: ActivityMock = { id: "moved", title: "Fresh title", description: "", image: "", type: "EVENT_FIXED", ageFrom: 0, ageTo: 18, currency: "BYN", tags: [] };
const cached = [
  { ...base, title: "Old title", citySlug: "brest", crossRegionReason: "FAMILY_SIGNAL" as const, crossRegionFamilyCount: 50, isPromoted: true, feedBucket: "primary" as const, ageHintBadge: "Подходит по возрасту" },
  { ...base, id: "revoked", crossRegionReason: "EDITORIAL_OVERRIDE" as const, crossRegionOverrideId: "expired", feedBucket: "primary" as const },
  { ...base, id: "second", feedBucket: "secondary" as const },
];
const details = [{ ...base, id: "second" }, { ...base, citySlug: "minsk", isPromoted: false }, { ...base, id: "new-candidate" }];
const result = restoreHydratedKudaItems(cached, details);
assert.deepEqual(result.map(card => card.id), ["moved", "second"], "restore global page order; omit revoked/expired cards; never add unselected inventory");
assert.equal(result[0].title, "Fresh title");
assert.equal(result[0].citySlug, "minsk");
assert.equal(result[0].isPromoted, false);
assert.equal(result[0].crossRegionReason, undefined, "an event moved into the region has no stale cross-region reason");
assert.equal(result[0].crossRegionFamilyCount, undefined, "cached eligibility evidence must not survive fresh hydration");
assert.equal(result[0].feedBucket, "primary");
assert.equal(result[0].ageHintBadge, "Подходит по возрасту");
assert.equal(result[1].feedBucket, "secondary");
console.log("Live Kuda hydration, expiry, source audit and stable pagination: OK");

import assert from "node:assert/strict";
import { resolveLegacySeoDestination } from "./legacySeoRedirectOverrides";
import { PHASE_2A_PRIORITY_RECOVERIES, validatePhase2AIntegrity } from "./phase2aPriorityRecovery";

assert.equal(
  resolveLegacySeoDestination("/master-klassy-dlya-detej", "/minsk/events"),
  "/minsk/events/category/workshops",
);

assert.equal(
  resolveLegacySeoDestination("/detskie-spektakli", "/minsk/events"),
  "/minsk/events/category/theatre",
);

assert.equal(
  resolveLegacySeoDestination(
    "/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
    "/minsk/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
  ),
  "/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
);

assert.equal(
  resolveLegacySeoDestination("/unchanged", "/minsk/blog/unchanged"),
  "/minsk/blog/unchanged",
);

const grodnoRecovery = PHASE_2A_PRIORITY_RECOVERIES.find((entry) => entry.position === 11);
assert.ok(grodnoRecovery);
assert.equal(grodnoRecovery.targetArticleId, "cmssu87vb00jews3fk0gbskm1");
assert.equal(grodnoRecovery.readiness, "READY_WITH_EXACT_MAPPING");
assert.equal(grodnoRecovery.geoScope, null);
assert.equal(grodnoRecovery.resolvedGeoScope, "REGION");
assert.equal(grodnoRecovery.regionSlug, "grodnenskaya-oblast");
assert.equal(grodnoRecovery.ownerReviewBatch, undefined);
assert.ok(grodnoRecovery.ownerDecision);
assert.deepEqual(validatePhase2AIntegrity(), []);

console.log("legacySeoRedirectOverrides.test.ts: all assertions passed");

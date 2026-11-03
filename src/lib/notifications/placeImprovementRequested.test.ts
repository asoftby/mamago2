import assert from "node:assert/strict";
import { getNotificationSurfaceDefaults } from "./settingsDomain";
import { getNotificationRegistryEntry } from "./notificationRegistry";
import { getNotificationHref } from "./routing";

const type = "PLACE_IMPROVEMENT_REQUESTED";
const entry = getNotificationRegistryEntry(type);
assert.ok(entry, "editorial correction request must be registered");
assert.equal(entry.surface, "BUSINESS");
assert.equal(entry.audience, "BUSINESS");
assert.deepEqual(getNotificationSurfaceDefaults("BUSINESS", type), {
  inApp: true,
  email: false,
  telegram: true,
});
assert.equal(
  getNotificationHref({
    type,
    entityType: "PLACE",
    entityId: "test-place-id",
    ctaAction: "/editor/place/test-place-id/edit#improvement-requests",
  } as Parameters<typeof getNotificationHref>[0]),
  "/editor/place/test-place-id/edit#improvement-requests",
);
assert.equal(
  entry.resolveHref?.({ entityType: "PLACE", entityId: "test-place-id" }),
  "/editor/place/test-place-id/edit#improvement-requests",
);
console.log("placeImprovementRequested.test.ts: OK");

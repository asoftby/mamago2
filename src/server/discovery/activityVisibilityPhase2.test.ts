import assert from "node:assert/strict";

import { activityInCityWhere } from "./activityInCityWhere";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";

function testActivityInCityWhereAllowsDirectCityIdWithoutPlace() {
  const where = activityInCityWhere("city-1");
  assert.deepEqual(where, { OR: [{ cityId: "city-1" }, { place: { cityId: "city-1" } }, { venue: { cityId: "city-1" } }] });
}

function testPublicListingDoesNotRequirePlaceOrCategory() {
  const where = getPublicListingActivityWhere();
  const json = JSON.stringify(where);
  assert.ok(!json.includes("placeId"), "public listing must not require placeId");
  assert.ok(!json.includes("eventCategoryId"), "public listing must not require eventCategoryId");
}

function testPublicListingExcludesArchivedActivities() {
  const json = JSON.stringify(getPublicListingActivityWhere());
  assert.ok(json.includes("ARCHIVED"), "public listing must exclude archived activities");
}

function main() {
  testActivityInCityWhereAllowsDirectCityIdWithoutPlace();
  testPublicListingDoesNotRequirePlaceOrCategory();
  testPublicListingExcludesArchivedActivities();
}

main();
console.log("activityVisibilityPhase2 tests: OK");

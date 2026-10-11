import assert from "node:assert/strict";
import test from "node:test";
import { canMovePlanItem } from "./planMoveEligibility";

test("Telegram record has a move button even without a linked catalog activity", () => {
  assert.equal(canMovePlanItem({ source: "TELEGRAM_FORWARD", activityId: null }), true);
  assert.equal(canMovePlanItem({ source: "MANUAL", activityId: null }), true);
  assert.equal(canMovePlanItem({ source: "CATALOG", activityId: "activity-1" }), true);
  assert.equal(canMovePlanItem({ source: "CATALOG", activityId: null }), false);
});

test("route, place and article bookmarks still do not display a move action", () => {
  assert.equal(canMovePlanItem({ source: "CATALOG", activityId: null, placeId: "place" }), false);
  assert.equal(canMovePlanItem({ source: "CATALOG", activityId: null, routeId: "route" }), false);
  assert.equal(canMovePlanItem({ source: "CATALOG", activityId: null, articleId: "article" }), false);
});

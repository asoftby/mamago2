import assert from "node:assert/strict";
import { canMovePlanItem, isLinkedEntityMove } from "./planMoveEligibility";

// «Перенести»: events, notes and place / offer / route entries; never an article
const mv = (over: Record<string, unknown>) => ({ source: "CATALOG" as const, activityId: null, routeId: null, planRouteSlug: null, placeId: null, planPlaceSlug: null, articleId: null, ...over });
assert.equal(canMovePlanItem(mv({ activityId: "a" })), true);
assert.equal(canMovePlanItem(mv({ placeId: "p" })), true, "a place point of a scenario can be moved");
assert.equal(canMovePlanItem(mv({ planPlaceSlug: "park" })), true);
assert.equal(canMovePlanItem(mv({ offerId: "o" })), true);
assert.equal(canMovePlanItem(mv({ planRouteSlug: "r" })), true);
assert.equal(canMovePlanItem(mv({ source: "TELEGRAM_FORWARD" })), true);
assert.equal(canMovePlanItem(mv({ source: "MANUAL" })), true);
assert.equal(canMovePlanItem(mv({ articleId: "ar" })), false, "an article cannot");
assert.equal(canMovePlanItem(mv({ source: "CATALOG" })), false, "an unlinked leftover cannot");
assert.equal(isLinkedEntityMove(mv({ placeId: "p" })), true, "moved by date only");
assert.equal(isLinkedEntityMove(mv({ offerId: "o" })), true);
assert.equal(isLinkedEntityMove(mv({ activityId: "a" })), false, "an event moves along its sessions");
assert.equal(isLinkedEntityMove(mv({ source: "MANUAL" })), false, "a note moves through /api/plan/manual");
assert.equal(isLinkedEntityMove(mv({ articleId: "ar", placeId: "p" })), false);

console.log("planMoveEligibility tests passed");

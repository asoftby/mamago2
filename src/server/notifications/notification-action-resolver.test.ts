import assert from "node:assert/strict";
import {
  resolveNotificationActionDefaults,
  resolveNotificationPageUrl,
} from "./notification-action-resolver";

assert.equal(
  resolveNotificationPageUrl({
    type: "SYSTEM",
    entityId: "VERIFY_EMAIL",
    actionUrl: "/me/settings/account",
  }),
  "/me/settings/email",
  "legacy verify-email route should canonicalize",
);

assert.equal(
  resolveNotificationActionDefaults({
    type: "SYSTEM",
    title: "Подтвердите email",
    body: "Подтвердите почту",
    actionMode: "PAGE",
    actionUrl: "/me/settings/account",
  }).actionUrl,
  "/me/settings/email",
  "new actions should persist canonical email settings route",
);

assert.equal(
  resolveNotificationPageUrl({
    type: "PLACE_APPROVED",
    entityType: "PLACE",
    entityId: "place-1",
    actionUrl: "/business/places/place-1/edit",
    placeSlug: "colt",
    citySlug: "minsk",
  }),
  "/minsk/places/colt",
  "approved place should open its city-scoped canonical public page",
);

assert.equal(
  resolveNotificationPageUrl({
    type: "PLACE_NEEDS_CHANGES",
    entityType: "PLACE",
    entityId: "place-1",
    actionUrl: "/business/places/place-1/edit",
    placeSlug: "colt",
    citySlug: "minsk",
  }),
  "/business/places/place-1/edit",
  "needs-changes place should stay in editor",
);

console.log("notification action resolver regressions: OK");

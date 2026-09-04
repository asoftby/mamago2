import assert from "node:assert/strict";
import { ScheduleMode } from "@prisma/client";
import {
  getActivityNotExpiredForPublicWhere,
  getPublicActivityDetailWhere,
  getPublicPageDetailWhere,
  getPublicPageIndexWhere,
  getPublicPublishedArticleWhere,
  getPublicPublishedOfferWhere,
  getPublicPublishedPlaceWhere,
  getPublicRouteDetailWhere,
  getPublicRouteIndexWhere,
} from "./publicContentVisibility";

assert.deepEqual(getPublicPublishedArticleWhere(), {
  status: "PUBLISHED",
});

assert.deepEqual(getPublicPageDetailWhere(), {
  status: "PUBLISHED",
  visibility: { in: ["PUBLIC", "UNLISTED"] },
});

assert.deepEqual(getPublicPageIndexWhere(), {
  status: "PUBLISHED",
  visibility: "PUBLIC",
});

assert.deepEqual(getPublicRouteDetailWhere(), {
  status: "PUBLISHED",
  visibility: { in: ["PUBLIC", "UNLISTED"] },
});

assert.deepEqual(getPublicRouteIndexWhere(), {
  status: "PUBLISHED",
  visibility: "PUBLIC",
});

const place = getPublicPublishedPlaceWhere();
assert.ok(Array.isArray(place.AND));
assert.ok(
  place.AND.some(
    (part) =>
      typeof part === "object" &&
      part !== null &&
      "status" in part &&
      (part as { status?: unknown }).status === "PUBLISHED",
  ),
  "public Place visibility must require PUBLISHED",
);

const offer = getPublicPublishedOfferWhere();
assert.ok(Array.isArray(offer.AND));
assert.ok(
  offer.AND.some(
    (part) =>
      typeof part === "object" &&
      part !== null &&
      "status" in part &&
      (part as { status?: unknown }).status === "PUBLISHED",
  ),
  "public Offer visibility must require PUBLISHED",
);

const activity = getPublicActivityDetailWhere();
assert.ok(Array.isArray(activity.AND));
const serializedActivity = JSON.stringify(activity);
for (const hidden of ["DRAFT", "PENDING", "NEEDS_REVISION", "REJECTED", "ARCHIVED", "DELETED"]) {
  assert.ok(
    serializedActivity.includes(hidden),
    `public Activity visibility must exclude ${hidden}`,
  );
}

// PENDING_UPDATE remains intentionally public until Event moves to revisions.
assert.ok(
  !serializedActivity.includes("PENDING_UPDATE"),
  "visibility foundation must preserve the current PENDING_UPDATE live behavior",
);

const now = new Date("2026-09-04T12:00:00.000Z");
const notExpired = getActivityNotExpiredForPublicWhere(now);
assert.deepEqual(
  notExpired,
  {
    OR: [
      { nextOccurrenceAt: { gte: now } },
      { sessions: { some: { startsAt: { gte: now } } } },
      {
        AND: [
          { nextOccurrenceAt: null },
          {
            scheduleMode: {
              in: [
                ScheduleMode.ALWAYS,
                ScheduleMode.ON_DEMAND,
                ScheduleMode.RECURRING,
              ],
            },
          },
        ],
      },
    ],
  },
  "public Activity expiry fallback must keep one future-session predicate plus the long-lived schedule fallback",
);

const serializedNotExpired = JSON.stringify(notExpired);
assert.equal(
  serializedNotExpired.match(/\"sessions\"/g)?.length ?? 0,
  1,
  "public Activity expiry predicate must not emit duplicate future-session relation checks",
);

console.log("✅ publicContentVisibility.test.ts — all assertions passed");

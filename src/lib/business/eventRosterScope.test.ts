import assert from "node:assert/strict";
import { BookingMode, BookingStatus } from "@prisma/client";
import { canShowEventRosterNames, eventRosterWhere } from "./eventRosterScope";

const startsAt = new Date("2026-11-28T09:00:00.000Z"); // 12:00 Minsk
const before = new Date("2026-11-27T12:00:00.000Z");
const during = new Date("2026-11-28T09:30:00.000Z");
const after = new Date("2026-11-28T21:00:00.000Z"); // past Minsk midnight

assert.equal(canShowEventRosterNames({ now: before, sessionStartsAt: startsAt }), false,
  "future roster may show counts but not names");
assert.equal(canShowEventRosterNames({ now: during, sessionStartsAt: startsAt }), true,
  "operational roster reveals minimal identities only during local event day");
assert.equal(canShowEventRosterNames({ now: after, sessionStartsAt: startsAt }), false,
  "post-event history never exposes identities in bulk");

const timed = eventRosterWhere({
  businessId: "owned-business", activityId: "owned-event", sessionStartsAt: startsAt,
  bookingMode: BookingMode.USE_PUBLICATION_SLOTS,
});
assert.equal(timed.businessId, "owned-business");
assert.equal(timed.activityId, "owned-event");
assert.deepEqual(timed.status, { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] });
const timedOr = timed.OR as Array<{ session?: { startsAt?: { gte?: Date; lt?: Date } }; requestedDate?: Date; requestedTime?: string }>;
assert.equal(timedOr.length, 2);
assert.equal(timedOr[0]?.session?.startsAt?.gte?.toISOString(), startsAt.toISOString());
assert.equal(timedOr[0]?.session?.startsAt?.lt?.getTime(), startsAt.getTime() + 60_000);
assert.equal(timedOr[1]?.requestedTime, "12:00");

const dates = eventRosterWhere({
  businessId: "owned-business", activityId: "owned-event", sessionStartsAt: startsAt,
  bookingMode: BookingMode.USE_PUBLICATION_DATES,
});
const dayOr = dates.OR as Array<{ session?: { startsAt?: { gte?: Date; lt?: Date } }; selectedSessionId?: null; requestedTime?: string | null }>;
assert.equal(dayOr[0]?.session?.startsAt?.gte?.toISOString(), "2026-11-27T21:00:00.000Z");
assert.equal(dayOr[0]?.session?.startsAt?.lt?.toISOString(), "2026-11-28T21:00:00.000Z");
assert.equal(dayOr[1]?.requestedTime, null);
console.log("eventRosterScope: ok");

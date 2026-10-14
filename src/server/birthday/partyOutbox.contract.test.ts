import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  heldPartyOutboxEventTypes, isPartyOutboxEventType, partyNotificationId, partyOutboxBackoff, partyOutboxCopy,
} from "./partyOutbox.logic";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";

assert.equal(partyNotificationId("event-1", "user-1"), partyNotificationId("event-1", "user-1"));
assert.notEqual(partyNotificationId("event-1", "user-1"), partyNotificationId("event-1", "user-2"));
assert.notEqual(partyNotificationId("event-1", "user-1"), partyNotificationId("event-2", "user-1"));
assert.equal(partyOutboxBackoff(0), 60_000);
assert.equal(partyOutboxBackoff(2), 240_000);
assert.equal(partyOutboxBackoff(20), 3_600_000);
for (const type of ["PARTY_REQUEST_SENT", "PARTY_QUOTE_SENT", "PARTY_REQUEST_DECLINED", "PARTY_REQUEST_EXPIRED"]) {
  assert.equal(isPartyOutboxEventType(type), true);
  const copy = partyOutboxCopy({ type: type as "PARTY_REQUEST_SENT", offerTitle: "Квест", dateLabel: "2026-10-20" });
  assert.match(copy.body, /Квест/);
  assert.doesNotMatch(copy.body, /телефон|\+375/i);
}
assert.equal(isPartyOutboxEventType("UNKNOWN"), false);
assert.equal(partyOutboxCopy({
  type: "PARTY_QUOTE_SENT", offerTitle: "Квест", dateLabel: "2026-10-20",
}).body.includes("Бронирование ещё не подтверждено"), true);
assert.equal(partyOutboxCopy({
  type: "PARTY_REQUEST_SENT", offerTitle: "Квест", dateLabel: "2026-10-20",
}).audience, "BUSINESS");
assert.equal(authorizeCronRequest(null, { NODE_ENV: "production" })?.status, 503);
assert.equal(authorizeCronRequest(null, { NODE_ENV: "production", CRON_SECRET: "secret" })?.status, 401);
assert.equal(authorizeCronRequest("Bearer secret", { NODE_ENV: "production", CRON_SECRET: "secret" }), null);

const worker = readFileSync("src/server/birthday/partyOutbox.service.ts", "utf8");
for (const invariant of [
  "skipDuplicates: true", "partyNotificationId(row.id, user.id)",
  "nextAttemptAt: { lte: now }", "attempts: { increment: 1 }",
  "notificationDelivery.count", "await dispatchDelivery(notification, user)",
  "getActiveTelegramConnection", // absence expected, dispatcher handles this
]) {
  if (invariant === "getActiveTelegramConnection") {
    assert.ok(!worker.includes(invariant), "Worker must reuse central dispatcher");
  } else {
    assert.ok(worker.includes(invariant), "Missing outbox invariant: " + invariant);
  }
}
assert.ok(!worker.includes("contactPhone: true"));
assert.ok(!worker.includes("customerPhone: true"));
// Business notifications deep-link into the unified inbox: held until the UI is released.
assert.deepEqual(heldPartyOutboxEventTypes({}), ["PARTY_REQUEST_SENT"]);
assert.deepEqual(heldPartyOutboxEventTypes({ BUSINESS_BOOKINGS_INBOX_UI: "false" }), ["PARTY_REQUEST_SENT"]);
assert.deepEqual(heldPartyOutboxEventTypes({ BUSINESS_BOOKINGS_INBOX_UI: "true" }), []);
assert.ok(worker.includes("notIn: heldPartyOutboxEventTypes(process.env)"), "Inbox-linked events must be gated");
for (const type of heldPartyOutboxEventTypes({})) {
  assert.ok(partyOutboxCopy({ type, offerTitle: "x", dateLabel: "y" }).actionUrl.startsWith("/business/bookings"));
}
console.log("partyOutbox.contract.test.ts: OK");

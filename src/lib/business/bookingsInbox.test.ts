import assert from "node:assert/strict";
import {
  archiveLabel, createIdempotencyKey, isLegacyCalendarView, maxExtendUntil,
  parseInboxKind, parseInboxTab, NEXT_ACTION_LABEL,
} from "./bookingsInbox";

const params = (query: string) => new URLSearchParams(query);

// tab/kind из ссылки уведомления PARTY_REQUEST_SENT
assert.equal(parseInboxTab(params("tab=action&kind=party").get("tab")), "action");
assert.equal(parseInboxKind(params("tab=action&kind=party").get("kind")), "party");
assert.equal(parseInboxTab(null), "action");
assert.equal(parseInboxTab("garbage"), "action");
assert.equal(parseInboxTab("ARCHIVE"), "archive");
assert.equal(parseInboxTab("AWAITING_CUSTOMER"), "customer");
assert.equal(parseInboxTab("upcoming"), "upcoming");
assert.equal(parseInboxKind("nope"), "all");
assert.equal(parseInboxKind("standard"), "standard");

// После принятия предложения семьёй бизнес должен подтвердить бронирование.
assert.match(NEXT_ACTION_LABEL.RECONFIRM, /Семья приняла условия/);
assert.match(NEXT_ACTION_LABEL.RECONFIRM, /подтвердите бронирование/);

// старые ссылки (?status=, ?id=, ?date=) остаются в календарном виде
assert.equal(isLegacyCalendarView(params("")), false);
assert.equal(isLegacyCalendarView(params("tab=action&kind=party")), false);
assert.equal(isLegacyCalendarView(params("status=pending")), true);
assert.equal(isLegacyCalendarView(params("id=abc")), true);
assert.equal(isLegacyCalendarView(params("view=calendar")), true);

// ключи идемпотентности проходят серверную проверку
for (let i = 0; i < 20; i++) {
  const key = createIdempotencyKey("party-respond");
  assert.ok(/^[A-Za-z0-9_-]{1,128}$/.test(key), key);
}
assert.notEqual(createIdempotencyKey("a"), createIdempotencyKey("a"));

// продление: ≤24ч и ≥1ч до события
const now = new Date("2026-10-14T10:00:00Z");
assert.equal(maxExtendUntil(now, null).toISOString(), "2026-10-15T10:00:00.000Z");
assert.equal(
  maxExtendUntil(now, new Date("2026-10-20T10:00:00Z")).toISOString(),
  "2026-10-15T10:00:00.000Z",
);
assert.equal(
  maxExtendUntil(now, new Date("2026-10-14T20:00:00Z")).toISOString(),
  "2026-10-14T19:00:00.000Z",
);

assert.equal(archiveLabel({ kind: "PARTY", status: "REJECTED", partyStage: "DECLINED" }), "Вы отказали");
assert.equal(archiveLabel({ kind: "STANDARD", status: "COMPLETED", partyStage: null }), "Состоялось");

console.log("bookingsInbox.test.ts: OK");

import assert from "node:assert/strict";
import type { BookingStatus as BookingStatusType, PartyRequestStage as PartyRequestStageType } from "@prisma/client";
const BookingKind = { STANDARD: "STANDARD", PARTY: "PARTY" } as const;
const BookingStatus = { NEW: "NEW", CONFIRMED: "CONFIRMED", COMPLETED: "COMPLETED", REJECTED: "REJECTED", CANCELLED: "CANCELLED", EXPIRED: "EXPIRED" } as const;
const PartyRequestStage = { SENT: "SENT", QUOTED: "QUOTED", AWAITING_RECONFIRM: "AWAITING_RECONFIRM", CONFIRMED: "CONFIRMED", DECLINED: "DECLINED", EXPIRED: "EXPIRED", NOT_ACCEPTED: "NOT_ACCEPTED", CANCELLED: "CANCELLED" } as const;
const QuoteStatus = { ACTIVE: "ACTIVE" } as const;
import { readFileSync } from "node:fs";
import {
  bookingBucket, assertPartyStatusPair, compareBookingDecisions,
  type BookingBucketInput,
} from "./bookingBucket";

const now = new Date("2026-10-13T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const base: BookingBucketInput = {
  kind: BookingKind.STANDARD,
  status: BookingStatus.NEW,
  createdAt: days(-2),
};
const classify = (changes: Partial<BookingBucketInput>) =>
  bookingBucket({ ...base, ...changes }, now);

assert.deepEqual(classify({}).bucket, "ACTION_REQUIRED");
assert.equal(classify({}).urgency, "CUSTOMER_WAITING");
assert.equal(classify({ serviceEndsAt: days(2) }).deadline?.getTime(), days(2).getTime(), "date of service orders undated STANDARD responses");
assert.equal(classify({ status: BookingStatus.CONFIRMED, hasServiceDate: true, serviceEndsAt: days(1) }).bucket, "UPCOMING");
assert.deepEqual(
  { b: classify({ status: BookingStatus.CONFIRMED, hasServiceDate: true, serviceEndsAt: days(-1) }).bucket,
    u: classify({ status: BookingStatus.CONFIRMED, hasServiceDate: true, serviceEndsAt: days(-1) }).urgency },
  { b: "ACTION_REQUIRED", u: "HOUSEKEEPING" },
);
assert.equal(classify({ status: BookingStatus.CONFIRMED, hasServiceDate: false, createdAt: days(-29) }).bucket, "UPCOMING");
assert.equal(classify({ status: BookingStatus.CONFIRMED, hasServiceDate: false, createdAt: days(-30) }).urgency, "HOUSEKEEPING");
assert.equal(classify({ status: BookingStatus.CONFIRMED, hasServiceDate: false, createdAt: days(-40), firstResponseAt: days(-5) }).bucket, "UPCOMING");
for (const status of [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.REJECTED]) {
  assert.equal(classify({ status }).bucket, "ARCHIVE", status);
}

const party: Partial<BookingBucketInput> = { kind: BookingKind.PARTY, status: BookingStatus.NEW };
assert.equal(classify({ ...party, partyStage: PartyRequestStage.SENT, responseDueAt: days(1) }).bucket, "ACTION_REQUIRED");
assert.equal(classify({ ...party, partyStage: PartyRequestStage.SENT, responseDueAt: days(-1) }).bucket, "ARCHIVE");
assert.equal(classify({ ...party, partyStage: PartyRequestStage.AWAITING_RECONFIRM, responseDueAt: days(1) }).action, "RECONFIRM");
assert.equal(classify({ ...party, partyStage: PartyRequestStage.QUOTED,
  quoteStatus: QuoteStatus.ACTIVE, quoteValidUntil: days(1) }).bucket, "AWAITING_CUSTOMER");
const expiredQuote = classify({ ...party, partyStage: PartyRequestStage.QUOTED,
  quoteStatus: QuoteStatus.ACTIVE, quoteValidUntil: days(-1), responseDueAt: days(-2) });
assert.equal(expiredQuote.bucket, "ACTION_REQUIRED");
assert.equal(expiredQuote.action, "EXTEND_OR_CLOSE");
assert.equal(expiredQuote.urgency, "CUSTOMER_WAITING");
assert.equal(classify({ ...party, partyStage: PartyRequestStage.QUOTED,
  quoteStatus: QuoteStatus.ACTIVE, quoteValidUntil: days(-1), serviceEndsAt: days(-1) }).bucket, "ARCHIVE");
assert.equal(classify({ ...party, partyStage: PartyRequestStage.CONFIRMED,
  status: BookingStatus.CONFIRMED, hasServiceDate: true, serviceEndsAt: days(2) }).bucket, "UPCOMING");
// An elapsed confirmed party has no supported STANDARD CLOSE_VISIT operation.
const elapsedParty = classify({ ...party, partyStage: PartyRequestStage.CONFIRMED,
  status: BookingStatus.CONFIRMED, hasServiceDate: true, serviceEndsAt: days(-1) });
assert.equal(elapsedParty.bucket, "ARCHIVE");
assert.equal(elapsedParty.action, "VIEW_ARCHIVE");
assert.equal(elapsedParty.urgency, null);
// Read-only archive does not alter the actual CONFIRMED party status.
assert.doesNotThrow(() => assertPartyStatusPair(PartyRequestStage.CONFIRMED, BookingStatus.CONFIRMED));

const terminal: [PartyRequestStageType, BookingStatusType][] = [
  [PartyRequestStage.DECLINED, BookingStatus.REJECTED],
  [PartyRequestStage.EXPIRED, BookingStatus.EXPIRED],
  [PartyRequestStage.NOT_ACCEPTED, BookingStatus.CANCELLED],
  [PartyRequestStage.CANCELLED, BookingStatus.CANCELLED],
];
for (const [stage, status] of terminal) {
  assert.doesNotThrow(() => assertPartyStatusPair(stage, status));
  assert.equal(classify({ kind: BookingKind.PARTY, partyStage: stage, status }).bucket, "ARCHIVE");
}
for (const stage of Object.values(PartyRequestStage)) {
  for (const status of Object.values(BookingStatus)) {
    const canonical =
      (stage === PartyRequestStage.SENT || stage === PartyRequestStage.QUOTED || stage === PartyRequestStage.AWAITING_RECONFIRM)
        ? BookingStatus.NEW
        : stage === PartyRequestStage.CONFIRMED ? BookingStatus.CONFIRMED
        : stage === PartyRequestStage.DECLINED ? BookingStatus.REJECTED
        : stage === PartyRequestStage.EXPIRED ? BookingStatus.EXPIRED
        : BookingStatus.CANCELLED;
    if (status === canonical) assert.doesNotThrow(() => assertPartyStatusPair(stage, status));
    else assert.throws(() => assertPartyStatusPair(stage, status), /Inconsistent PARTY/);
  }
}
assert.throws(() => assertPartyStatusPair(null, BookingStatus.NEW));

const wait = classify({});
const routine = classify({ status: BookingStatus.CONFIRMED, serviceEndsAt: days(-1), hasServiceDate: true });
assert.ok(compareBookingDecisions(
  { decision: wait, createdAt: days(-10) },
  { decision: routine, createdAt: days(-1) },
) < 0, "CUSTOMER_WAITING must sort ahead of HOUSEKEEPING");
const urgent = classify({ ...party, partyStage: PartyRequestStage.SENT, responseDueAt: days(1) });
const later = classify({ ...party, partyStage: PartyRequestStage.SENT, responseDueAt: days(3) });
assert.ok(compareBookingDecisions(
  { decision: urgent, createdAt: days(-5) },
  { decision: later, createdAt: days(-10) },
) < 0, "response deadline must sort ahead of creation time");

// API and privacy wiring must stay unified.
const inbox = readFileSync("src/server/services/booking/businessInbox.service.ts", "utf8");
const route = readFileSync("src/app/api/business/bookings/inbox/route.ts", "utf8");
const outcome = readFileSync("src/server/services/booking/bookingOutcome.service.ts", "utf8");
const resolution = readFileSync("src/server/birthday/partyQuoteResolution.service.ts", "utf8");
assert.ok(inbox.includes("bookingBucket("));
assert.ok(inbox.includes("menuBadge: customerWaiting"));
assert.ok(inbox.includes("totals[decision.bucket]++"));
assert.ok(!inbox.includes("customerPhone: true") && !inbox.includes("contactPhone: true"));
assert.ok(route.includes("getMyBusiness"));
assert.ok(outcome.includes("BookingStatus.CANCELLED") && outcome.includes('reason: "BUSINESS_CANCELLED"') === false);
assert.ok(outcome.includes("tx.bookingActivity.create") && outcome.includes("tx.adminAuditLog.create"));
assert.ok(resolution.includes("Idempotency") === false || resolution.includes("idempotencyKey"));
assert.ok(resolution.includes('eventType: "PARTY_QUOTE_CLOSED"'));
console.log("bookingBucket.contract.test.ts: OK");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidePartyInviteDispatch } from "./partyInviteDispatchPolicy";

const source = readFileSync("src/server/birthday/partyInviteTransactionalDispatch.service.ts", "utf8");
for (const invariant of [
  'FROM "PartyOrderItem" WHERE "id" =', 'FOR UPDATE',
  "decidePartyInviteDispatch(", "bookingRequestId: null",
  'status: "QUEUED"', 'status: "SENT"',
  "partyProviderInvite.updateMany(", "claim.count !== 1",
  "bookingRequest.create(", "bookingActivity.create(",
  "partyProviderInvite.update(", "bookingRequestId: request.id",
  "partyOutbox.create(", 'dedupeKey: "party:" + request.id + ":sent"',
  "item.confirmedBookingRequestId", "Обнаружены заявки вне очереди исполнителей",
]) assert.ok(source.includes(invariant), "Missing transaction invariant: " + invariant);
assert.ok(!source.includes("export async function GET") &&
  !source.includes("export async function POST"), "Must not expose dispatch route");
const now = new Date("2026-10-29T12:00:00.000Z");
const queued = Array.from({ length: 5 }, (_, position) => ({
  id: String(position), offerId: "offer" + position,
  businessId: "business" + position, position,
  status: "QUEUED" as const, responseDueAt: null,
}));
assert.deepEqual(decidePartyInviteDispatch(queued, "PARALLEL", now).dispatchIds,
  ["0", "1", "2", "3", "4"]);
assert.deepEqual(decidePartyInviteDispatch(queued, "SEQUENTIAL", now).dispatchIds, ["0"]);
const sent = queued.map((x, i) => i === 0
  ? { ...x, status: "SENT" as const, responseDueAt: new Date(now.getTime() + 60000) } : x);
assert.deepEqual(decidePartyInviteDispatch(sent, "SEQUENTIAL", now).dispatchIds, []);
assert.deepEqual(decidePartyInviteDispatch(sent.map((x,i) =>
  i === 0 ? { ...x, status: "CONFIRMED" as const } : x), "PARALLEL", now).dispatchIds, []);
const expiry = readFileSync("src/server/birthday/partyRequestExpiry.service.ts", "utf8");
for (const guard of [
  'FROM "PartyOrderItem"', 'FOR UPDATE',
  'bookingRequestId: request.id, status: "SENT"',
  'data: { status: "EXPIRED", resolvedAt: now }',
  'status: "QUEUED"', 'status: "REQUESTED"',
]) assert.ok(expiry.includes(guard), "Expiry must keep request and queue consistent: " + guard);
const business = readFileSync("src/server/birthday/partyBusiness.service.ts", "utf8");
for (const guard of [
  'bookingRequestId: requestId, status: "SENT"',
  'status: declined ? "DECLINED" : autoConfirm ? "CONFIRMED" : "QUOTED"',
  'partyOrderItemId: item.id, status: "QUEUED"',
  'queuedAlternatives > 0 ? PartyItemStatus.REQUESTED',
]) assert.ok(business.includes(guard), "Business replies must synchronize invite state: " + guard);
console.log("partyInviteTransactionalDispatch.contract.test.ts: OK");

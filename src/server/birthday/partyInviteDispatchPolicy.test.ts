import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decidePartyInviteDispatch, type PartyInviteQueueEntry,
} from "./partyInviteDispatchPolicy";

const now = new Date("2026-10-28T12:00:00.000Z");
const rows: PartyInviteQueueEntry[] = Array.from({ length: 5 }, (_, n) => ({
  id: "invite" + n,
  offerId: "offer" + n,
  businessId: "business" + n,
  position: n,
  status: "QUEUED",
  responseDueAt: null,
}));
const parallel = decidePartyInviteDispatch(rows, "PARALLEL", now);
assert.deepEqual(parallel.dispatchIds, rows.map(x => x.id));
assert.deepEqual(parallel.expireIds, []);
assert.deepEqual(decidePartyInviteDispatch([...rows].reverse(), "SEQUENTIAL", now).dispatchIds,
  ["invite0"], "sequential mode must respect candidate priority");
const sent: PartyInviteQueueEntry[] = rows.map((row, i) =>
  i === 0 ? { ...row, status: "SENT", responseDueAt: new Date(now.getTime() + 1_000) } : row);
assert.deepEqual(decidePartyInviteDispatch(sent, "SEQUENTIAL", now).dispatchIds, [],
  "do not send to candidate 2 while candidate 1 can respond");
assert.deepEqual(decidePartyInviteDispatch(sent, "PARALLEL", now).dispatchIds,
  ["invite1", "invite2", "invite3", "invite4"],
  "parallel dispatch only claims still-queued invitations");
const overdue = sent.map((row, i) => i === 0
  ? { ...row, responseDueAt: new Date(now.getTime() - 1_000) } : row);
assert.deepEqual(decidePartyInviteDispatch(overdue, "SEQUENTIAL", now),
  { expireIds: ["invite0"], dispatchIds: [] },
  "must record timeout before dispatching next candidate");
const expired = rows.map((row, i) => i === 0 ? { ...row, status: "EXPIRED" as const } : row);
assert.deepEqual(decidePartyInviteDispatch(expired, "SEQUENTIAL", now).dispatchIds, ["invite1"]);
for (const terminal of ["DECLINED", "CANCELLED"] as const) {
  assert.deepEqual(decidePartyInviteDispatch(rows.map((r,i) =>
    i===0 ? {...r,status:terminal} : r), "SEQUENTIAL", now).dispatchIds, ["invite1"]);
}
for (const pause of ["QUOTED", "ACCEPTED", "CONFIRMED"] as const) {
  const staged = rows.map((r,i) => i===0 ? {...r,status:pause} : r);
  assert.deepEqual(decidePartyInviteDispatch(staged, "SEQUENTIAL", now).dispatchIds, []);
  if (pause !== "QUOTED") assert.deepEqual(decidePartyInviteDispatch(staged, "PARALLEL", now).dispatchIds, []);
}
assert.deepEqual(decidePartyInviteDispatch([], "PARALLEL", now).dispatchIds, []);
assert.throws(() => decidePartyInviteDispatch([...rows, { ...rows[0], id:"extra", businessId:"extra", offerId:"extra", position:5 }], "PARALLEL", now));
assert.throws(() => decidePartyInviteDispatch([rows[0], {...rows[1], businessId:rows[0].businessId}], "PARALLEL", now));
assert.throws(() => decidePartyInviteDispatch([rows[0], {...rows[1], position:0}], "SEQUENTIAL", now));

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261028172000_party_provider_invite_queue/migration.sql", "utf8");
const queue = readFileSync("src/server/birthday/partyInviteQueue.service.ts", "utf8");
for (const token of [
  "model PartyProviderInvite {", "enum PartyProviderDispatchMode {",
  "enum PartyProviderInviteStatus {",
  "@@unique([partyOrderItemId, businessId])",
  "@@unique([partyOrderItemId, position])",
  "bookingRequestId String? @unique",
]) assert.ok(schema.includes(token), "Missing durable queue schema: " + token);
for (const token of [
  'CREATE TABLE "PartyProviderInvite"',
  '"PartyProviderInvite_partyOrderItemId_businessId_key"',
  '"PartyProviderInvite_partyOrderItemId_position_key"',
  'ON DELETE CASCADE',
]) assert.ok(migration.includes(token), "Missing migration guard: " + token);
for (const token of [
  'FOR UPDATE', 'candidates.length > 5',
  'partyOrder.status !== "ANCHOR_CONFIRMED"',
  'item.status !== "PLANNED"', 'verifyPartyOffers(',
  'partyProviderInvite.createMany(', 'alreadyQueued: true',
]) assert.ok(queue.includes(token), "Queue must be safe and replayable: " + token);
assert.ok(!queue.includes("bookingRequest.create") && !queue.includes("partyOutbox.create"),
  "initializing a queue must not send invitations or mutate requests");
console.log("partyInviteDispatchPolicy.test.ts: OK");

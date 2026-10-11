import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PartyApiError, createPartyDraftSchema, updatePartyDraftSchema,
  partyStartAt, validateSubmissionWindow } from "./partyDraft.validation";

assert.equal(createPartyDraftSchema.safeParse({ citySlug: "minsk", venueMode: "HOME" }).success, true);
assert.equal(createPartyDraftSchema.safeParse({ citySlug: "minsk", venueMode: "HOME", ownerUserId: "admin" }).success, false);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, eventDate: "2026-10-15", timeFrom: "12:00", timeTo: "18:00" }).success, true);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, eventDate: "2026-02-30" }).success, false);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, timeFrom: "27:00" }).success, false);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, anchorOfferId: "o1" }).success, false);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, anchorOfferId: "o1", addonOfferIds: ["o2"] }).success, true);
assert.equal(updatePartyDraftSchema.safeParse({ version: -1 }).success, false);
assert.equal(updatePartyDraftSchema.safeParse({ version: 0, status: "ANCHOR_CONFIRMED" }).success, false);

const eventDate = new Date("2026-10-15T00:00:00Z");
const start = partyStartAt(eventDate, "12:00");
assert.equal(start.toISOString(), "2026-10-15T09:00:00.000Z");
const now = new Date("2026-10-11T09:00:00.000Z");
assert.equal(validateSubmissionWindow(start, now).toISOString(), "2026-10-12T09:00:00.000Z");
const urgentNow = new Date("2026-10-13T09:00:00.000Z");
assert.equal(validateSubmissionWindow(start, urgentNow).toISOString(), "2026-10-13T13:00:00.000Z");
assert.throws(() => validateSubmissionWindow(start, new Date("2026-10-14T09:00:00.000Z")), PartyApiError);

const submit = readFileSync("src/server/birthday/partySubmit.service.ts", "utf8");
for (const needle of [
  "customerName: null", "customerPhone: null", "tx.partyOutbox.create",
  "tx.bookingActivity.create", "tx.bookingRequest.create", "submitKey",
  "kind: \"PARTY\"", "partyStage: \"SENT\"",
]) assert.ok(submit.includes(needle), "Missing submit invariant: " + needle);
assert.ok(!submit.includes("dispatchDelivery("), "Submission must never send notifications inline.");
const read = readFileSync("src/server/birthday/partyDraft.service.ts", "utf8");
assert.match(read, /ownerUserId, status: "DRAFT", version/);
assert.match(read, /getPublicPublishedOfferWhere/);
assert.match(read, /key: "BIRTHDAY", status: "APPROVED"/);
console.log("partyDraft.contract.test.ts: OK");

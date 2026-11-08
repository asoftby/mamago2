import assert from "node:assert/strict";
import test from "node:test";
import { projectProgramme, validateProgramme, programmeCommandSchema, type ProgrammeSource } from "./partyProgramme";
const item = (id: string, category = "ANIMATOR") => ({ id, category, role: "ADDON", parentItemId: null,
  status: "PLANNED", position: 0, serviceStart: null, serviceEnd: null, requests: [] });
const party: ProgrammeSource = { status: "ANCHOR_PENDING", eventDate: new Date("2026-11-22"),
  timeFrom: "14:00", timeTo: "16:00", programme: null, items: [item("private-id")] };
test("public projection contains only allowlisted categories, times and independent statuses", () => {
  const output = projectProgramme({ ...party, ...{ childName: "PRIVATE_CHILD", contactPhone: "SECRET", publicPlanToken: "TOKEN" },
    items: [{ ...item("private-id"), ...{ offer: { title: "PRIVATE_TITLE" } },
      requests: [{ partyStage: "QUOTED", partyQuotes: [{ status: "ACTIVE", validUntil: new Date("2099-01-01") }] }] }] });
  assert.deepEqual(output, { date: "2026-11-22", rows: [{ id: "1", title: "Анимационная программа", from: null, to: null, status: "AGREEMENT" }] });
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE|SECRET|TOKEN/);
});
test("expired quote and refused providers do not imply confirmations", () => {
  assert.equal(projectProgramme({ ...party, items: [{ ...item("a"), requests: [{ partyStage: "QUOTED", partyQuotes: [{ status: "ACTIVE", validUntil: new Date(0) }] }] }] }).rows[0].status, "REPLACE");
  assert.equal(projectProgramme({ ...party, items: [{ ...item("a"), requests: [{ partyStage: "DECLINED", partyQuotes: [] }] }] }).rows[0].status, "DECLINED");
});
test("changed included component remains unagreed until canonical cancellation", () => {
  const included = { ...item("a"), role: "INCLUDED", packageComponentChange: { creditByn: "100" }, requests: [{ partyStage: "CONFIRMED", partyQuotes: [] }] };
  assert.equal(projectProgramme({ ...party, items: [included] }).rows[0].status, "AGREEMENT");
  assert.equal(projectProgramme({ ...party, items: [{ ...included, status: "CANCELLED" }] }).rows[0].status, "CANCELLED");
});
test("manual time rejects foreign rows, reversed/partial intervals and time outside booking", () => {
  assert.ok(validateProgramme([{ itemId: "foreign", from: null, to: null }], party));
  for (const [from, to] of [["14:30", null], ["15:00", "14:00"], ["13:00", "15:00"], ["15:00", "17:00"]])
    assert.ok(validateProgramme([{ itemId: "private-id", from, to }], party));
  assert.equal(validateProgramme([{ itemId: "private-id", from: "14:15", to: "15:15" }], party), null);
  assert.equal(party.items[0].serviceStart, null);
});
test("request bounds, duplicate IDs and unrecognized fields are rejected", () => {
  assert.equal(programmeCommandSchema.safeParse({ action: "programme", version: 0, entries: [
    { itemId: "a", from: null, to: null }, { itemId: "a", from: null, to: null }] }).success, false);
  assert.equal(programmeCommandSchema.safeParse({ action: "publicLink", version: 0, days: 365 }).success, false);
  assert.equal(programmeCommandSchema.safeParse({ action: "saveToPlan", version: 0, ownerUserId: "other" }).success, false);
});

test("later provider window changes never expose an invalid manual interval or lose confirmation", () => {
  const confirmed = { ...item("a"), status: "CONFIRMED", serviceStart: new Date("2026-11-22T12:00:00Z"),
    serviceEnd: new Date("2026-11-22T13:00:00Z"), requests: [{ partyStage: "NOT_ACCEPTED", partyQuotes: [] }] };
  const view = projectProgramme({ ...party, programme: [{ itemId: "a", from: "14:00", to: "15:30" }], items: [confirmed] });
  assert.equal(view.rows[0].status, "CONFIRMED");
  assert.equal(view.rows[0].from, "15:00");
  assert.equal(view.rows[0].to, "16:00");
  assert.equal(view.rows[0].timeConflict, true);
});

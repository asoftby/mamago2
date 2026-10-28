import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewPartySlots, type PreviewUnit } from "./partyPublicSlots";

const day = "2026-11-16"; // Monday in Europe/Minsk
const now = new Date("2026-11-01T00:00:00.000Z");
const unit: PreviewUnit = {
  status: "ACTIVE", timezone: "Europe/Minsk",
  capacity: 12, prepMinutes: 30, cleanupMinutes: 30,
  minDurationMinutes: 60, stepMinutes: 60,
  rules: [{ weekday: 1, startMinutes: 600, endMinutes: 1080 }],
  exceptions: [], blocks: [], allocations: [],
};
function preview(units: PreviewUnit[] = [unit], guests = 8) {
  return previewPartySlots({ day, durationMinutes: 180, guestCount: guests, now, units });
}
assert.deepEqual(preview().map(s => s.start), ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]);
assert.deepEqual(preview().map(s => s.end), ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
assert.deepEqual(preview([unit], 13), [], "capacity must be respected");
assert.deepEqual(preview([{ ...unit, status: "INACTIVE" }]), [], "inactive resources cannot appear");
assert.deepEqual(preview([{ ...unit, timezone: "UTC" }]), [], "timezone must be Minsk");
assert.deepEqual(preview([{ ...unit, minDurationMinutes: 240 }]), [], "respect minimum duration");
assert.deepEqual(preview([{ ...unit, exceptions: [
  { kind: "CLOSED", startMinutes: 660, endMinutes: 900 },
] }]).map(s => s.start), ["15:00"], "partial closure blocks overlapping service intervals");
assert.deepEqual(preview([{ ...unit, rules: [], exceptions: [
  { kind: "OPEN_OVERRIDE", startMinutes: 720, endMinutes: 960 },
] }]).map(s => s.start), ["12:00", "13:00"], "open override adds a specific working window");

const blocked = {
  blockStart: new Date("2026-11-16T09:30:00.000Z"),
  blockEnd: new Date("2026-11-16T10:30:00.000Z"),
};
assert.deepEqual(preview([{ ...unit, allocations: [blocked] }]).map(s => s.start),
  ["14:00", "15:00"], "allocations overlap prep/cleanup buffers");
assert.deepEqual(preview([{ ...unit, blocks: [blocked] }]).map(s => s.start),
  ["14:00", "15:00"], "manual calendar blocks must be respected");
assert.deepEqual(preview([unit, { ...unit, allocations: [blocked] }]), preview(), "union of available resources cannot double-count slots");
assert.deepEqual(previewPartySlots({ day: "2026-02-30", durationMinutes: 180, guestCount: 3, now, units: [unit] }), []);
assert.deepEqual(previewPartySlots({ day, durationMinutes: 10, guestCount: 3, now, units: [unit] }), []);
assert.deepEqual(previewPartySlots({ day, durationMinutes: 180, guestCount: 3, now: new Date("2026-11-16T13:00:00Z"), units: [unit] }), [], "past service start must not show");
const service = readFileSync("src/server/birthday/partyPublicSlots.service.ts", "utf8");
const endpoint = readFileSync("src/app/api/public/birthday/availability/route.ts", "utf8");
for (const s of [
  "getPublicBirthdayOfferWhere(city.id)", "ownerBusinessId",
  'status: "CONFIRMED"', 'status: "HELD", expiresAt: { gt: now }',
  'return { mode: "REQUEST_ONLY" as const, slots: [] }',
]) assert.ok(service.includes(s), "missing public visibility/booking safety guard " + s);
assert.ok(endpoint.includes('"Cache-Control": "private, no-store"'), "availability is not cacheable");
assert.ok(!endpoint.includes("unitId"), "never expose resource identifiers");
console.log("partyPublicSlots.test.ts: OK");

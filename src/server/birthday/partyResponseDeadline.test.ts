import assert from "node:assert/strict";
import { partyResponseDeadline } from "./partyResponseDeadline";
const utc = (time: string) => new Date(time);
const future = utc("2026-12-31T09:00:00Z");
// Minsk 10:00–12:00, ordinary 2 working hours.
assert.equal(partyResponseDeadline(utc("2026-11-01T07:00:00Z"), future).toISOString(), "2026-11-01T09:00:00.000Z");
// Minsk 20:30 + 30 minutes today + 90 minutes tomorrow = 10:30 local.
assert.equal(partyResponseDeadline(utc("2026-11-01T17:30:00Z"), future).toISOString(), "2026-11-02T07:30:00.000Z");
// After closing: starts at 09:00 local tomorrow.
assert.equal(partyResponseDeadline(utc("2026-11-01T20:00:00Z"), future).toISOString(), "2026-11-02T08:00:00.000Z");
// Urgent under 72 hours: one working hour.
assert.equal(partyResponseDeadline(utc("2026-11-01T17:30:00Z"), utc("2026-11-03T15:00:00Z")).toISOString(), "2026-11-02T06:30:00.000Z");
// Midnight and UTC day boundaries do not affect Minsk work hours.
assert.equal(partyResponseDeadline(utc("2026-11-01T01:00:00Z"), future).toISOString(), "2026-11-01T08:00:00.000Z");
// Never allow response after party minus one hour.
assert.equal(partyResponseDeadline(utc("2026-11-01T17:30:00Z"), utc("2026-11-02T07:00:00Z")).toISOString(), "2026-11-02T06:00:00.000Z");
console.log("partyResponseDeadline tests: OK");

import assert from "node:assert/strict";
import { minskBookingWindow, isWithinSchedule } from "./partyConfirmationAvailability";

const d = new Date("2026-11-16T00:00:00.000Z"); // Monday
const w = minskBookingWindow(d, "12:00", "15:00", 30, 45);
assert.equal(w.serviceStart.toISOString(), "2026-11-16T09:00:00.000Z");
assert.equal(w.blockStart.toISOString(), "2026-11-16T08:30:00.000Z");
assert.equal(w.blockEnd.toISOString(), "2026-11-16T12:45:00.000Z");
assert.equal(w.weekday, 1);
assert.throws(() => minskBookingWindow(d, "15:00", "12:00", 0, 0));
assert.throws(() => minskBookingWindow(d, "bad", "16:00", 0, 0));
const weekday = [{ weekday: 1, startMinutes: 600, endMinutes: 1080 }];
assert.equal(isWithinSchedule(w, weekday, []), true);
assert.equal(isWithinSchedule(w, [], []), false);
assert.equal(isWithinSchedule(w, weekday, [{ kind: "CLOSED", startMinutes: null, endMinutes: null }]), false);
assert.equal(isWithinSchedule(w, weekday, [{ kind: "CLOSED", startMinutes: 890, endMinutes: 930 }]), false);
assert.equal(isWithinSchedule(w, [], [{ kind: "OPEN_OVERRIDE", startMinutes: 700, endMinutes: 980 }]), true);
assert.equal(isWithinSchedule(w, [], [{ kind: "OPEN_OVERRIDE", startMinutes: 800, endMinutes: 980 }]), false);
console.log("Party confirmation availability tests: OK");

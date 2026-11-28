import * as assert from "node:assert/strict";

import { getDefaultFormData } from "./defaults";
import { validateStep } from "./validation";
import { mapCtaStepValueToEventFormPatch } from "./ctaStepMapper";
import { getEventBookingCapacityIssues } from "./eventBookingCapacityValidation";
import type { EventFormData } from "./types";

const date = "2026-12-12";
function legacyEvent(capacities: Array<number | null>): EventFormData {
  const data = getDefaultFormData();
  data.participationMode = "time-slots";
  data.timeSlots = {
    dates: [{
      id: "day-1",
      isoDate: date,
      label: date,
      slots: capacities.map((capacity, i) => ({
        id: `slot-${i}`,
        startTime: "10:00",
        endTime: "11:00",
        capacity,
      })),
    }],
  };
  return data;
}

// No valid booking should be published with missing, zero, fractional,
// or partial per-slot capacities.
for (const invalid of [null, 0, -1, 1.5]) {
  const data = legacyEvent([8, invalid]);
  assert.ok(getEventBookingCapacityIssues(data).some((e) => e.includes("вместимость")));
  const result = validateStep(6, data);
  assert.equal(result.isValid, false);
  assert.equal(result.isComplete, false);
}
assert.deepEqual(getEventBookingCapacityIssues(legacyEvent([8, 2])), []);
assert.ok(getEventBookingCapacityIssues(legacyEvent([])).length > 0);

// Legacy access editor is the authoritative source while editing: incomplete
// rows must not be ignored just because valid slots exist elsewhere.
{
  const data = legacyEvent([8]);
  data.publicationAccess = {
    method: "timeslots",
    timeSlots: [
      { id: "ok", date, startTime: "10:00", endTime: "11:00", capacity: 8 },
      { id: "missing", date, startTime: "12:00", endTime: "13:00", capacity: null },
    ],
  };
  assert.ok(getEventBookingCapacityIssues(data).some((e) => e.includes("вместимость")));
  data.publicationAccess.timeSlots![1]!.capacity = 3;
  assert.deepEqual(getEventBookingCapacityIssues(data), []);
}

// Shared calendar: capacity is mandatory on a date even without timed slots.
// The legacy compatibility projection must never silently invent one seat.
for (const mode of ["DATE_ONLY", "DATE_AND_TIME"] as const) {
  const initial = getDefaultFormData();
  const cta = {
    actionChoice: "REQUEST" as const,
    requestMode: "CALENDAR" as const,
    calendarMode: mode,
    externalKind: "SITE" as const,
    externalUrl: "",
    instructions: "",
    requestLabelKind: "BOOK" as const,
    legacyOrigin: "CTA" as const,
    fallback: { phone: "", website: "" },
    calendarDays: [{
      id: "day-1",
      date,
      capacity: null as number | null,
      slots: [{ id: "slot-1", startTime: "10:00", endTime: "11:00", capacity: null as number | null }],
    }],
  };
  const patch = mapCtaStepValueToEventFormPatch(cta);
  const data = { ...initial, ...patch };
  assert.equal(data.participationMode, "time-slots");
  assert.equal(data.timeSlots.dates[0]?.slots[0]?.capacity, null);
  assert.ok(getEventBookingCapacityIssues(data).some((e) => e.includes("вместимость")));
  assert.equal(validateStep(6, data).isComplete, false);
  if (mode === "DATE_ONLY") cta.calendarDays[0]!.capacity = 10;
  else cta.calendarDays[0]!.slots[0]!.capacity = 6;
  const valid = { ...initial, ...mapCtaStepValueToEventFormPatch(cta) };
  assert.deepEqual(getEventBookingCapacityIssues(valid), []);
}

assert.deepEqual(getEventBookingCapacityIssues(getDefaultFormData()), []);
console.log("event booking capacity validation: OK");

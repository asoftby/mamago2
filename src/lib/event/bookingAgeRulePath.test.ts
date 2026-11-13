import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveSimpleBookingWithAgeRule, type ActivityForEventPageInput } from "./buildEventPageDataFromPrisma";
import { childAgeWarning } from "@/lib/booking/bookingParticipants";

// Prisma-row shape (as returned by the public loader) → page data → age rule.
// Restriction stored ONLY in months (ageTags empty) must reach the booking modal.
const row = {
  id: "event-months-only",
  bookingEnabled: true,
  businessId: "business-1",
  bookingMode: "REQUEST_ONLY",
  scheduleJson: { participationMode: "request" },
  sessions: [],
  ageTags: [],
  agePolicy: "SPECIFIC",
  ageMinMonths: 72,
  ageMaxMonths: 132,
} as unknown as ActivityForEventPageInput;

const booking = resolveSimpleBookingWithAgeRule(row.id, row);
assert.ok(booking?.ageRule, "months-only restriction produces a rule");
assert.equal(booking?.ageRule?.label, "6–11 лет");
assert.equal(childAgeWarning(4, booking?.ageRule ?? null), "Событие для 6–11 лет");
assert.equal(childAgeWarning(8, booking?.ageRule ?? null), null);

// Without the months the same row has no rule (documents why the loader must pass them).
const withoutMonths = resolveSimpleBookingWithAgeRule(row.id, { ...row, ageMinMonths: null, ageMaxMonths: null });
assert.equal(withoutMonths?.ageRule, null);

// The public loader builds its result field by field: both month fields must be mapped.
const loader = readFileSync(new URL("./loadPublicActivityForCityPage.ts", import.meta.url), "utf8");
assert.match(loader, /ageMinMonths:\s*activity\.ageMinMonths/);
assert.match(loader, /ageMaxMonths:\s*activity\.ageMaxMonths/);

console.log("bookingAgeRulePath tests passed");

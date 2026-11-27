import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const step = readFileSync("src/components/business/wizard/event/steps/Step5PricingParticipation.tsx", "utf8");
const access = readFileSync("src/features/publication-access/components/PublicationAccessEditor.tsx", "utf8");
const cta = readFileSync("src/components/business/wizard/shared/CtaStep/CtaStep.tsx", "utf8");
const card = readFileSync("src/components/business/events/EventCardHorizontal.tsx", "utf8");
const loader = readFileSync("src/server/services/business/businessEventsList.service.ts", "utf8");

assert.ok(step.includes("timeSlotSettings={seatModeFields}"), "Legacy editor gets event seat mode inside selected time-slot form");
assert.ok(step.includes("calendarSettings={seatModeFields}"), "Shared CTA gets event seat mode inside calendar booking");
assert.ok(step.includes("const seatModeFields = ("), "The seat mode editor is reusable across both CTA variants");
assert.ok(access.includes('{method === "timeslots" ? timeSlotSettings : null}'));
assert.ok(cta.includes("{calendarSettings}"));
assert.ok(card.includes("activity.hasBookingHistory ?"));
assert.ok(loader.includes("publicationType: PublicationType.EVENT"));
assert.ok(loader.includes("activityId: { in: ownedActivityIds }"));
assert.ok(!loader.includes("status: { in: ["), "Historical booking eligibility must include every status");
console.log("Event booking seat mode placement and participants action: PASS");

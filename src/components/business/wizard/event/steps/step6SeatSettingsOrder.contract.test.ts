import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const step = source("src/components/business/wizard/event/steps/Step5PricingParticipation.tsx");
const shared = source("src/components/business/wizard/shared/CtaStep/CtaStep.tsx");
const legacy = source("src/features/publication-access/components/PublicationAccessEditor.tsx");

assert.match(step, /const seatModeFields = \(/);
assert.match(step, /calendarSettings=\{seatModeFields\}/);
assert.match(step, /timeSlotSettings=\{seatModeFields\}/);

// Both editors place the seat-counting choice after choosing the booking
// method but directly before the calendar or slot form.
const sharedMethod = shared.indexOf("<StableCardSelectorSmall");
const sharedSettings = shared.indexOf("{calendarSettings}");
const sharedCalendar = shared.indexOf("<CtaCalendarEditor");
assert.ok(sharedMethod !== -1 && sharedMethod < sharedSettings && sharedSettings < sharedCalendar);

const legacyMethod = legacy.indexOf("<AccessMethodCard");
const legacySettings = legacy.indexOf("{timeSlotSettings}");
const legacySlots = legacy.indexOf("<TimeSlotEditor");
assert.ok(legacyMethod !== -1 && legacyMethod < legacySettings && legacySettings < legacySlots);

console.log("event step 6 seat settings ordering contract: OK");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../server/services/planSuggestions.service.ts", import.meta.url), "utf8");

// The day screen no longer shows an audience picker: «Для кого» became a filter of the day list
// by person (only when the family has more than one member). Suggestions still use the
// resolved default participants as the explicit audience.
assert.doesNotMatch(content, /renderAudiencePicker|PlanSuggestionAudiencePicker/);
assert.match(content, /personas\.length < 2 \? null/);
assert.match(content, /<PlanPersonFilter/);
assert.match(content, /value=\{personFilter\}/);
assert.match(content, /onChange=\{setPersonFilter\}/);

// The request and local draft must use the explicit plan audience, not
// an implicit global discovery selection.
assert.match(content, /audienceIds: planAudienceIds/);
assert.match(content, /createPlanSuggestionAudienceSnapshot\(ages, planAudienceIds\)/);
assert.match(content, /const ages = childIds.length === 0 && planAudienceIds.length > 0/);
assert.match(service, /if \(rows.length === 0 && ageRangeValues.length > 0 && !adultOnly\)/);

// No technical batch counters in the result summary.
assert.doesNotMatch(content, /\{suggestions\.length\} идеи · подборка/);
assert.match(content, /На эту дату подходящих событий пока нет/);

console.log("Plan person filter and result copy contract: OK");

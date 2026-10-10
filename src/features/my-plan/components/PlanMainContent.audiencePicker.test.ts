import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("./PlanSuggestionAudiencePicker.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../server/services/planSuggestions.service.ts", import.meta.url), "utf8");

// Desktop and mobile must expose the same visible audience choice.
assert.equal((content.match(/\{renderAudiencePicker\(\)\}/g) ?? []).length, 2);
assert.match(picker, /Для кого ищем\?/);
assert.match(picker, /aria-pressed=\{selected\}/);
assert.match(picker, /onChange\(\[\]\)/);

// The request and local draft must use the explicit plan audience, not
// an implicit global discovery selection.
assert.match(content, /audienceIds: planAudienceIds/);
assert.match(content, /createPlanSuggestionAudienceSnapshot\(ages, planAudienceIds\)/);
assert.match(content, /writeLastPlanParticipants\(ids\)/);
assert.match(content, /const ages = childIds.length === 0 && planAudienceIds.length > 0/);
assert.match(service, /if \(rows.length === 0 && ageRangeValues.length > 0 && !adultOnly\)/);

// No technical batch counters in the result summary.
assert.doesNotMatch(content, /\{suggestions\.length\} идеи · подборка/);
assert.match(content, /На эту дату подходящих событий пока нет/);

console.log("Plan audience picker and result copy contract: OK");

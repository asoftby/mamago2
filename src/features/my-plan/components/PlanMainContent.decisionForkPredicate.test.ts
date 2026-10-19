import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static-source contract (PlanMainContent needs many providers, so there is no mount harness).
// v3 day screen: the old «Реши за меня / Сама решу» fork is replaced by the «Идеи» block
// (quiet «Подобрать, куда сходить» link → dashed «Идеи на сегодня · от mamaGo»). Both rendering
// branches (desktop and compact) must render the same day body, so they cannot drift apart.
const source = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");

assert.doesNotMatch(source, /RecommendationDecisionBlock|showDecisionFork/, "decision fork is gone from the day screen");
assert.equal((source.match(/\{renderDayList\((true|false)\)\}/g) ?? []).length, 2, "both layouts render the day list");
assert.equal((source.match(/\{renderIdeas\(\)\}/g) ?? []).length, 2, "both layouts render the ideas block");
assert.equal((source.match(/\{renderPersonFilter\(false\)\}/g) ?? []).length, 1, "desktop renders the person filter once");
assert.equal((source.match(/\{renderPersonFilter\(true\)\}/g) ?? []).length, 1, "compact renders the person filter once");

// Ideas: quiet link before the first request, dashed block with «+» after it.
assert.match(source, /Подобрать, куда сходить/);
assert.match(source, /Идеи на \{isTodaySelected \? "сегодня" : "этот день"\}/);
assert.match(source, /от mamaGo/);
assert.match(source, /aria-label="Добавить в план"/);
assert.match(source, /Подобрать ещё/);

// Age question still gates the first request when the audience age is unknown.
assert.match(source, /awaitingAgeAnswer\) \{\s*return <PlanNeedsAgeQuestion/);

// Calm empty day, with a way back from a person filter.
assert.match(source, /<PlanEmptyDayMessage \/>/);
const emptyMessage = readFileSync(new URL("./PlanEmptyDayMessage.tsx", import.meta.url), "utf8");
assert.match(emptyMessage, /Свободный день\./);
assert.match(source, /Показать всех/);

console.log("PlanMainContent day screen (ideas, filter, empty day) contract: OK");

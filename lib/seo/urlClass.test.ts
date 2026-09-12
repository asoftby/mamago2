import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SEO_BASELINE } from "../../config/seo-baseline";
import { classifyUrl, URL_CLASS_RULES_VERSION, type UrlClass } from "./urlClass";

const fixturePath = join(process.cwd(), "data", "seo", "url-class.csv");
const fixtureLines = readFileSync(fixturePath, "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1);

assert.equal(fixtureLines.length, 63, "url-class.csv must retain all 63 audited v3.3 fixture rows");

for (const line of fixtureLines) {
  const firstComma = line.indexOf(",");
  const secondComma = line.indexOf(",", firstComma + 1);
  assert.ok(firstComma > 0 && secondComma > firstComma, `invalid fixture row: ${line}`);

  const url = line.slice(0, firstComma);
  const expectedClass = line.slice(firstComma + 1, secondComma) as UrlClass;
  const fixtureBasis = line.slice(secondComma + 1);
  const actual = classifyUrl(url);

  assert.equal(actual.class, expectedClass, `${url}: ${actual.class} != ${expectedClass}`);
  assert.ok(actual.basis.length > 0, `${url}: classifier basis must not be empty`);
  assert.ok(fixtureBasis.length > 0, `${url}: fixture basis must not be empty`);
}

// Calendar rules win before namespace rules.
assert.equal(classifyUrl("https://mamago.by/minsk/blog/novyj-god-2027-kuda-pojti").class, "event");
assert.equal(classifyUrl("https://mamago.by/minsk/routes/marshrut-naroch").class, "evergreen");
assert.equal(classifyUrl("https://mamago.by/breakingnews/otkrylsya-novyj-park").class, "unclear");
assert.equal(classifyUrl("https://mamago.by/minsk/events/festival-test").class, "event");
assert.equal(classifyUrl("https://mamago.by/minsk/places/test-place").class, "evergreen");

// Deliberate recalculation reminder: changing URL_CLASS_RULES_VERSION without
// recording a new baseline computation timestamp must fail this regression.
const RECALC_STAMP_BY_RULES_VERSION: Record<number, string> = {
  1: "2026-09-11T07:47:00.000Z",
};
assert.equal(SEO_BASELINE.urlClassRulesVersion, URL_CLASS_RULES_VERSION);
assert.equal(
  SEO_BASELINE.computedAt,
  RECALC_STAMP_BY_RULES_VERSION[URL_CLASS_RULES_VERSION],
  "URL classification rules changed without a recorded SEO baseline recomputation",
);

console.log("urlClass.test.ts: all assertions passed");

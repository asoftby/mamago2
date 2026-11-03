import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Regression for PROD: 21 interests in /api/public/signals/interests,
 * but a server-provided list with 20 prevented "history" from appearing.
 */
const source = readFileSync(
  "src/components/business/wizard/event/steps/Step1Basics.tsx",
  "utf8",
);

assert.match(
  source,
  /useEffect\(\(\) => \{\s*if \(!initialTaxonomies\) return;/,
  "server-provided taxonomy must still trigger a client-side interests refresh",
);

assert.match(
  source,
  /fetch\("\/api\/public\/signals\/interests", \{ cache: "no-store" \}\)/,
  "live interests request must bypass the browser fetch cache",
);

assert.match(
  source,
  /setInterestOptions\(freshOptions\.length > 0 \? freshOptions : buildFallbackInterestOptions\(\)\)/,
  "a valid response must replace stale server-provided interests",
);

assert.match(
  source,
  /const interestItems: ChipItem\[\] = interestOptions\.map\(/,
  "all interests must render as chips without an implicit list-size limit",
);

assert.doesNotMatch(
  source,
  /interestOptions\.slice\(0,\s*20\)/,
  "interest options must never be capped at 20",
);

console.log("event wizard live interests freshness contract: OK");

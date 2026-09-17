/**
 * Static wiring checks for /api/business/events/[id]/schedule-source/route.ts
 * (GET) — same technique as media-picker/route.test.ts (getCurrentUser()'s
 * cookies() call needs a real Next.js request scope, so the handler can't be
 * invoked directly here).
 *
 * Regression target: any non-null `source` ActivitySession means the import
 * pipeline still owns this schedule, even if every source row has already
 * been withdrawn. The endpoint must keep readOnly: true while displaying only
 * active source rows. Ordinary business/family.by events keep readOnly: false.
 *
 * Запуск: npx tsx "src/app/api/business/events/[id]/schedule-source/route.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/business/events/[id]/schedule-source/route.ts", "utf8");

assert.match(
  source,
  /const sourceOwnedSessions = await prisma\.activitySession\.findMany\(\{\s*\n\s*where:\s*\{\s*activityId,\s*source:\s*\{\s*not:\s*null\s*\}\s*\},/,
  "must detect source ownership from all imported ActivitySession rows, including withdrawn history",
);

assert.match(
  source,
  /select:\s*\{\s*startsAt:\s*true,\s*withdrawnAt:\s*true\s*\}/,
  "must load lifecycle state so withdrawn rows can be hidden without dropping source ownership",
);

assert.match(
  source,
  /if \(sourceOwnedSessions\.length > 0\) \{/,
  "must keep the schedule protected whenever any source-owned session exists",
);

assert.match(
  source,
  /sourceOwnedSessions\s*\n\s*\.filter\(\(session\) => session\.withdrawnAt == null\)/,
  "must display only active source sessions",
);

assert.match(
  source,
  /return NextResponse\.json\(\{ items, readOnly: true \}\);/,
  "source-owned schedule branch must report readOnly: true even when items is empty",
);

assert.match(
  source,
  /return NextResponse\.json\(\{\s*\n\s*items: items\.length > 0 \? items : buildScheduleItems\(rawSource\),\s*\n\s*readOnly: false,\s*\n\s*\}\);/,
  "the pre-existing family.by/manual text-extraction branch must keep reporting readOnly: false",
);

console.log("business events [id] schedule-source GET readonly wiring test: OK");

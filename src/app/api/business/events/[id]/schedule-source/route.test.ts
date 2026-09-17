/**
 * Static wiring checks for /api/business/events/[id]/schedule-source/route.ts
 * (GET) — same technique as media-picker/route.test.ts (getCurrentUser()'s
 * cookies() call needs a real Next.js request scope, so the handler can't be
 * invoked directly here).
 *
 * Regression target: when an activity has an ACTIVE ActivitySession with a
 * non-null `source` (import-created, e.g. ABWS), this endpoint must report
 * those sessions with readOnly: true, and must not fall through to the
 * normalizedData/rawPayload-derived (editable) branch. Withdrawn imported
 * sessions are lifecycle history and must not appear as current schedule.
 * Ordinary business/family.by events keep readOnly: false.
 *
 * Запуск: npx tsx "src/app/api/business/events/[id]/schedule-source/route.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/business/events/[id]/schedule-source/route.ts", "utf8");

assert.match(
  source,
  /const importedSessions = await prisma\.activitySession\.findMany\(\{\s*\n\s*where:\s*\{\s*activityId,\s*source:\s*\{\s*not:\s*null\s*\},\s*withdrawnAt:\s*null\s*\},/,
  "must look up only active ActivitySession rows with a non-null source before falling back to import-record text extraction",
);

assert.match(
  source,
  /if \(importedSessions\.length > 0\) \{/,
  "must branch on the presence of active imported sessions",
);

assert.match(
  source,
  /return NextResponse\.json\(\{ items, readOnly: true \}\);/,
  "active imported-session branch must report readOnly: true",
);

assert.match(
  source,
  /return NextResponse\.json\(\{\s*\n\s*items: items\.length > 0 \? items : buildScheduleItems\(rawSource\),\s*\n\s*readOnly: false,\s*\n\s*\}\);/,
  "the pre-existing family.by/manual text-extraction branch must keep reporting readOnly: false",
);

console.log("business events [id] schedule-source GET readonly wiring test: OK");

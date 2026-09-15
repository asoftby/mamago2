/**
 * Static wiring check for BACKLOG-153: updateActivity()'s destructive
 * sessions deleteMany+recreate must be gated on `applySessionsUpdate`,
 * which is forced false whenever the target Activity already has any
 * ActivitySession with a non-null `source` (import-created, e.g. ABWS) —
 * mirroring PR #298's hasImportedSessions gate for
 * src/app/api/business/events/[id]/route.ts, which never covered this
 * older route (PATCH /api/business/activities/[id]).
 *
 * This is a source-level regression guard runnable without a database
 * (check:push has no DB dependency); the actual read/write behavior is
 * proven by the real-DB integration test in
 * activity.service.readonlyImportSessions.integration.test.ts, which is
 * NOT part of check:push (same as this repo's other *.integration.test.ts
 * files) since it needs a live Postgres connection.
 *
 * Запуск: npx tsx src/server/services/activity.service.readonlyImportSessions.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/server/services/activity.service.ts", "utf8");

assert.match(
  source,
  /let applySessionsUpdate = sessions !== undefined;/,
  "must start from the same sessions!==undefined signal as before this fix",
);

assert.match(
  source,
  /const hasImportedSessions = existingSessions\.some\(\(s\) => s\.source != null\);\s*\n\s*if \(hasImportedSessions\) \{\s*\n\s*applySessionsUpdate = false;\s*\n\s*\}/,
  "must force applySessionsUpdate to false whenever any existing session has a non-null source",
);

assert.match(
  source,
  /if \(applySessionsUpdate\) \{\s*\n\s*\/\/ Delete existing sessions[^\n]*\n\s*await prisma\.activitySession\.deleteMany\(\{\s*\n\s*where: \{ activityId, source: null \},\s*\n\s*\}\);/,
  "the deleteMany must be gated behind applySessionsUpdate AND scoped to source: null — a concurrent " +
    "ABWS upsert landing between the read and this delete (found by automated review on PR #302/#303) " +
    "must never be removed by it, regardless of timing",
);

assert.match(
  source,
  /sessions:\s*\n\s*applySessionsUpdate\s*\n\s*\?\s*\{\s*\n\s*create: \(sessions as Date\[\]\)\.map/,
  "the relational recreate must also be gated behind the same applySessionsUpdate flag — both halves must move together",
);

console.log("activity.service readonly-import-sessions wiring test: OK");

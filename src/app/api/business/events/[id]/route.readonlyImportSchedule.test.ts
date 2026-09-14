/**
 * Static wiring checks for /api/business/events/[id]/route.ts (PATCH) — same
 * technique as media-picker/route.test.ts (getCurrentUser()'s cookies() call
 * needs a real Next.js request scope, so the handler can't be invoked
 * directly here).
 *
 * Regression target: an activity with import-created ActivitySession rows
 * (source != null, e.g. ABWS) must never have those sessions replaced by the
 * wizard's own scheduleJson-driven resync, on ANY save — including a save
 * that only touches an unrelated field like the description. Before this
 * fix, activitySessionsNeedResync compared fingerprints unconditionally, and
 * the wizard's scheduleJson has no representation for imported sessions
 * (no scheduleItems/dates array), so the fingerprints always mismatched and
 * the sessions were silently deleteMany()'d + recreated as blank rows on the
 * very first save of every imported card.
 *
 * Запуск: npx tsx "src/app/api/business/events/[id]/route.readonlyImportSchedule.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/business/events/[id]/route.ts", "utf8");

assert.match(
  source,
  /sessions:\s*{\s*orderBy:\s*{\s*startsAt:\s*"asc"\s*},\s*select:\s*{\s*startsAt:\s*true,\s*source:\s*true\s*},?\s*}/,
  "the sessions fetch must select `source` so imported sessions can be detected",
);

assert.match(
  source,
  /const hasImportedSessions = existing\.sessions\.some\(\(s\) => s\.source != null\);/,
  "must derive hasImportedSessions from a non-null session.source",
);

assert.match(
  source,
  /const activitySessionsNeedResync =\s*\n\s*!hasImportedSessions &&\s*\n\s*\(eventSessionScheduleFingerprint\(existing\.scheduleJson\) !== nextScheduleFingerprint \|\|\s*\n\s*eventSessionFingerprintFromStoredSessions\(existing\.sessions\) !== nextScheduleFingerprint\)/,
  "activitySessionsNeedResync must be short-circuited to false whenever the activity has any imported session, regardless of fingerprint comparison",
);

console.log("business events [id] PATCH readonly-import-schedule wiring test: OK");

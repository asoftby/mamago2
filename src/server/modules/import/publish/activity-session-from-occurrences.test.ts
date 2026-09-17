import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildActivitySessionUpsertArgs,
  shouldApplyImportedScheduleSessions,
} from "./activity-session-from-occurrences";
import { ABWS_PARSER_KEY } from "../normalizers/abws-event.normalizer";
import type { EventImportOccurrence } from "../types";

// ── manual schedule ownership blocks later import-session recreation
assert.equal(shouldApplyImportedScheduleSessions(undefined), true);
assert.equal(shouldApplyImportedScheduleSessions(null), true);
assert.equal(shouldApplyImportedScheduleSessions("PREFER_IMPORT"), true);
assert.equal(shouldApplyImportedScheduleSessions("PREFER_MANUAL"), false);
assert.equal(shouldApplyImportedScheduleSessions("LOCKED"), false);

// ── import override check + session writes + reconciliation must share the same transaction lock
{
  const source = readFileSync(
    "src/server/modules/import/publish/activity-session-from-occurrences.ts",
    "utf8",
  );
  const lockSource = readFileSync(
    "src/server/modules/import/services/activity-schedule-lock.ts",
    "utf8",
  );
  assert.match(
    source,
    /prisma\.\$transaction\(async \(tx\)/,
    "import session publish must run in one transaction",
  );
  const lockIndex = source.indexOf("acquireActivityScheduleLock(tx, activityId)");
  const overrideIndex = source.indexOf("tx.importFieldOverride.findUnique");
  const upsertIndex = source.indexOf("tx.activitySession.upsert");
  const reconcileIndex = source.indexOf("tx.activitySession.updateMany");
  const nextOccurrenceIndex = source.indexOf("tx.activity.update");
  assert.ok(lockIndex !== -1, "import session publish must acquire the schedule advisory lock");
  assert.ok(overrideIndex > lockIndex, "manual-override state must be read after taking the lock");
  assert.ok(upsertIndex > overrideIndex, "session upserts must happen only after the locked override check");
  assert.ok(reconcileIndex > upsertIndex, "missing-session reconciliation must happen after current-session upserts");
  assert.ok(nextOccurrenceIndex > reconcileIndex, "nextOccurrenceAt must be refreshed after session reconciliation");
  assert.match(
    lockSource,
    /SELECT 1 AS locked FROM pg_advisory_xact_lock\(hashtextextended\(/,
    "Prisma-safe advisory lock query must project a supported scalar instead of PostgreSQL void",
  );
  assert.doesNotMatch(
    lockSource,
    /SELECT\s+pg_advisory_xact_lock\(/,
    "advisory lock must not expose PostgreSQL void directly to Prisma raw-query deserialization",
  );
  assert.match(
    source,
    /source:\s*ABWS_PARSER_KEY,[\s\S]*?withdrawnAt:\s*null,[\s\S]*?externalId:\s*\{\s*notIn:\s*currentExternalIds\s*\}/,
    "active ABWS rows missing from the current authoritative snapshot must be marked withdrawn",
  );
  assert.match(
    source,
    /data:\s*\{\s*nextOccurrenceAt\s*\}/,
    "session reconciliation must persist the recomputed nextOccurrenceAt",
  );
}

// ── happy path: full occurrence -> full upsert args, keyed on source+externalId
{
  const occurrence = {
    externalId: "session-42",
    startAt: "2026-07-01T10:00:00.000Z",
    buyUrl: "https://24afisha.by/buy/session-42",
    priceMinCents: 500,
    priceMaxCents: 900,
    isSaleOpen: true,
    withdrawnAt: "2026-06-30T12:00:00.000Z",
  } as EventImportOccurrence & { withdrawnAt: string };

  const args = buildActivitySessionUpsertArgs("activity-1", occurrence);

  assert.ok(args, "expected non-null upsert args");
  assert.deepEqual(args!.where, {
    source_externalId: { source: ABWS_PARSER_KEY, externalId: "session-42" },
  });
  assert.equal((args!.create as { activity: { connect: { id: string } } }).activity.connect.id, "activity-1");
  assert.equal((args!.create as { source: string }).source, ABWS_PARSER_KEY);
  assert.equal((args!.create as { externalId: string }).externalId, "session-42");
  assert.equal((args!.create as { buyUrl: string }).buyUrl, "https://24afisha.by/buy/session-42");
  assert.equal((args!.create as { priceMinCents: number }).priceMinCents, 500);
  assert.equal((args!.create as { priceMaxCents: number }).priceMaxCents, 900);
  assert.equal((args!.create as { isSaleOpen: boolean }).isSaleOpen, true);
  assert.deepEqual((args!.create as { withdrawnAt: Date }).withdrawnAt, new Date("2026-06-30T12:00:00.000Z"));
  assert.deepEqual(args!.update, {
    startsAt: new Date("2026-07-01T10:00:00.000Z"),
    buyUrl: "https://24afisha.by/buy/session-42",
    priceMinCents: 500,
    priceMaxCents: 900,
    isSaleOpen: true,
    withdrawnAt: new Date("2026-06-30T12:00:00.000Z"),
  });
}

// ── missing externalId -> null (can't upsert without the identity key)
{
  const args = buildActivitySessionUpsertArgs("activity-1", {
    startAt: "2026-07-01T10:00:00.000Z",
  });
  assert.equal(args, null);
}

// ── missing startAt -> null (NOT NULL scalar)
{
  const args = buildActivitySessionUpsertArgs("activity-1", { externalId: "session-1" });
  assert.equal(args, null);
}

// ── unparseable startAt -> null
{
  const args = buildActivitySessionUpsertArgs("activity-1", {
    externalId: "session-1",
    startAt: "not-a-date",
  });
  assert.equal(args, null);
}

// ── optional fields absent -> explicit null, not undefined (Prisma-safe),
// including withdrawnAt so a source session can be re-activated.
{
  const args = buildActivitySessionUpsertArgs("activity-1", {
    externalId: "session-2",
    startAt: "2026-07-01T10:00:00.000Z",
  });
  assert.ok(args);
  assert.equal((args!.create as { buyUrl: unknown }).buyUrl, null);
  assert.equal((args!.create as { priceMinCents: unknown }).priceMinCents, null);
  assert.equal((args!.create as { priceMaxCents: unknown }).priceMaxCents, null);
  assert.equal((args!.create as { isSaleOpen: unknown }).isSaleOpen, null);
  assert.equal((args!.create as { withdrawnAt: unknown }).withdrawnAt, null);
}

// ── changed published ABWS snapshots auto-sync sessions after normalization;
// source-null rows fail closed instead of getting mixed with source-owned rows.
{
  const normalizationSource = readFileSync(
    "src/server/modules/import/services/import-normalization.service.ts",
    "utf8",
  );
  assert.match(
    normalizationSource,
    /source\.parserKey === ABWS_PARSER_KEY[\s\S]*?record\.publishedActivityId[\s\S]*?Array\.isArray\(normalized\.occurrences\)/,
    "published ABWS schedule sync must be gated to linked ABWS records with an authoritative occurrences snapshot",
  );
  assert.match(
    normalizationSource,
    /activitySession\.count\(\{[\s\S]*?source:\s*null/,
    "auto-sync must detect source-null sessions before writing imported rows",
  );
  assert.match(
    normalizationSource,
    /if \(sourceNullSessions > 0\)[\s\S]*?else \{[\s\S]*?upsertActivitySessionsFromOccurrences\(/,
    "source-null legacy/manual state must fail closed before ABWS session sync",
  );
}

// ── withdrawn rows are lifecycle history, not public/current schedule.
{
  const publicLoader = readFileSync("src/lib/event/loadPublicActivityForCityPage.ts", "utf8");
  const visibility = readFileSync("src/server/public/publicContentVisibility.ts", "utf8");
  const dateFilters = readFileSync("src/server/discovery/eventFilterSemantics.ts", "utf8");
  const scheduleSource = readFileSync("src/app/api/business/events/[id]/schedule-source/route.ts", "utf8");
  const manualTakeover = readFileSync("src/app/api/business/events/[id]/schedule-source/manual/route.ts", "utf8");

  assert.match(
    publicLoader,
    /sessions:\s*\{[\s\S]*?where:\s*\{\s*startsAt:\s*\{\s*gte:\s*now\s*\},\s*withdrawnAt:\s*null\s*\}/,
    "public event detail must exclude withdrawn future sessions",
  );
  assert.match(
    visibility,
    /sessions:\s*\{\s*some:\s*\{\s*startsAt:\s*\{\s*gte:\s*now\s*\},\s*withdrawnAt:\s*null\s*\}\s*\}/,
    "public listing visibility must ignore withdrawn future sessions",
  );
  assert.match(
    dateFilters,
    /startsAt:\s*\{\s*gte:\s*filters\.dateRange\.start,\s*lt:\s*filters\.dateRange\.end\s*\},\s*withdrawnAt:\s*null/,
    "date filters must ignore withdrawn sessions",
  );
  assert.match(
    scheduleSource,
    /const sourceOwnedSessions = await prisma\.activitySession\.findMany[\s\S]*?source:\s*\{\s*not:\s*null\s*\}[\s\S]*?filter\(\(session\) => session\.withdrawnAt == null\)/,
    "wizard must preserve import ownership while displaying only active source sessions",
  );
  assert.match(
    manualTakeover,
    /const sourceOwnedSessions = await tx\.activitySession\.findMany[\s\S]*?source:\s*\{\s*not:\s*null\s*\}[\s\S]*?const importedSessions = sourceOwnedSessions\.filter\(\(session\) => session\.withdrawnAt == null\)/,
    "manual takeover must recognize source ownership even when every session is withdrawn",
  );
}

console.log("activity-session-from-occurrences tests: OK");

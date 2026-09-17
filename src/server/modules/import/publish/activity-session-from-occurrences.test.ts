import assert from "node:assert/strict";

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

// ── happy path: full occurrence -> full upsert args, keyed on source+externalId
{
  const occurrence: EventImportOccurrence = {
    externalId: "session-42",
    startAt: "2026-07-01T10:00:00.000Z",
    buyUrl: "https://24afisha.by/buy/session-42",
    priceMinCents: 500,
    priceMaxCents: 900,
    isSaleOpen: true,
  };

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
  assert.deepEqual(args!.update, {
    startsAt: new Date("2026-07-01T10:00:00.000Z"),
    buyUrl: "https://24afisha.by/buy/session-42",
    priceMinCents: 500,
    priceMaxCents: 900,
    isSaleOpen: true,
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

// ── optional fields absent -> explicit null, not undefined (Prisma-safe)
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
}

console.log("activity-session-from-occurrences tests: OK");

import assert from "node:assert/strict";
import { ABWS_PARSER_KEY } from "../normalizers/abws-event.normalizer";
import { buildActivitySessionUpsertArgs } from "./activity-session-from-occurrences";

const occurrence = { externalId: "minsk_kids/3743#1", startAt: "2026-11-01T19:00:00+03:00" };

// Default source stays ABWS: existing callers are unchanged.
{
  const args = buildActivitySessionUpsertArgs("act-1", occurrence)!;
  assert.deepEqual(args.where, { source_externalId: { source: ABWS_PARSER_KEY, externalId: occurrence.externalId } });
  assert.equal((args.create as { source: string }).source, ABWS_PARSER_KEY);
}

// A Telegram occurrence is written as source "telegram", never as ABWS.
{
  const args = buildActivitySessionUpsertArgs("act-1", occurrence, "telegram")!;
  assert.deepEqual(args.where, { source_externalId: { source: "telegram", externalId: occurrence.externalId } });
  assert.equal((args.create as { source: string }).source, "telegram");
}

// Session title: written only when the source passes one.
{
  const without = buildActivitySessionUpsertArgs("act-1", occurrence, "telegram")!;
  assert.equal("title" in (without.update as object), false, "no title key: a manual or earlier title is not wiped");
  assert.equal("title" in (without.create as object), false);

  const withTitle = buildActivitySessionUpsertArgs("act-1", { ...occurrence, title: "  K-pop Edition  " }, "telegram")!;
  assert.equal((withTitle.update as { title: string }).title, "K-pop Edition");
  assert.equal((withTitle.create as { title: string }).title, "K-pop Edition");

  const long = buildActivitySessionUpsertArgs("act-1", { ...occurrence, title: "я".repeat(300) }, "telegram")!;
  assert.equal((long.update as { title: string }).title.length, 120, "ActivitySession.title is VarChar(120)");

  const blank = buildActivitySessionUpsertArgs("act-1", { ...occurrence, title: "   " }, "telegram")!;
  assert.equal((blank.update as { title: string | null }).title, null);
}

console.log("activity-session-source tests: OK");

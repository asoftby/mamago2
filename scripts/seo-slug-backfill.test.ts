import assert from "node:assert/strict";

import { parseSeoSlugBackfillArgs, SEO_SLUG_BACKFILL_ENTITIES } from "./seo-slug-backfill";

assert.deepEqual(
  parseSeoSlugBackfillArgs(["--preview"]),
  { preview: true, confirmWrites: false, confirmProduction: false, entities: new Set(SEO_SLUG_BACKFILL_ENTITIES), limit: undefined },
);

assert.throws(() => parseSeoSlugBackfillArgs([]), /exactly one of --preview or --confirm-writes/);
assert.throws(() => parseSeoSlugBackfillArgs(["--preview", "--confirm-writes"]), /exactly one of --preview or --confirm-writes/);

const write = parseSeoSlugBackfillArgs(["--confirm-writes", "--confirm-production", "--limit", "10"]);
assert.equal(write.preview, false);
assert.equal(write.confirmWrites, true);
assert.equal(write.confirmProduction, true);
assert.equal(write.limit, 10);
assert.deepEqual(write.entities, new Set(SEO_SLUG_BACKFILL_ENTITIES));

const scoped = parseSeoSlugBackfillArgs(["--preview", "--entities", "place,offer"]);
assert.deepEqual(scoped.entities, new Set(["place", "offer"]));

assert.throws(() => parseSeoSlugBackfillArgs(["--preview", "--entities", "place,bogus"]), /Unknown entity "bogus"/);
assert.throws(() => parseSeoSlugBackfillArgs(["--preview", "--entities", ""]), /must not be empty/);
assert.throws(() => parseSeoSlugBackfillArgs(["--confirm-writes", "--limit", "0"]), /Invalid --limit/);
assert.throws(() => parseSeoSlugBackfillArgs(["--confirm-writes", "--limit", "abc"]), /Invalid --limit/);

console.log("seo-slug-backfill parseArgs tests: OK");

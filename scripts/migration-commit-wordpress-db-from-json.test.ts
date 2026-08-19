import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PrismaClient } from "@prisma/client";

import { EventCommitRunner } from "../src/lib/migration/commit/event/EventCommitRunner";
import type { MigrationLineageLookup } from "../src/lib/migration/core/orchestrator";
import {
  buildExecutionPlanInputFromJsonFixture,
  buildRunners,
  createJsonFixtureExecutor,
  parseArgs,
  parseFixture,
} from "./migration-commit-wordpress-db-from-json";
import type { WordPressJsonFixture } from "./migration-commit-wordpress-db-from-json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FLAGS = ["--fixture", "fixture.json", "--context-config", "context.json", "--confirm-writes"];

const fixture: WordPressJsonFixture = {
  posts: [
    {
      ID: 437,
      post_author: 1,
      post_date: "2026-01-01 00:00:00",
      post_content: "<p>Place content</p>",
      post_title: "Fixture Place",
      post_excerpt: "Fixture excerpt",
      post_status: "publish",
      post_name: "fixture-place",
      post_modified: "2026-01-02 00:00:00",
      post_parent: 0,
      guid: "https://example.com/?p=437",
      post_type: "places",
      post_mime_type: "",
    },
  ],
  postmeta: [
    { meta_id: 1, post_id: 437, meta_key: "short-desc-place", meta_value: "Short desc" },
    { meta_id: 2, post_id: 437, meta_key: "phone", meta_value: "+375291234567" },
  ],
  terms: [
    { post_id: 437, term_id: 20, name: "Cafe", slug: "kids-cafe", taxonomy: "places_category" },
  ],
  placeIndex: [
    { post_id: 437, post_status: "publish", priority: 5, lat: 53.9, lng: 27.5667 },
  ],
};

function testParsesValidFlags() {
  const args = parseArgs(REQUIRED_FLAGS);
  assert.deepEqual(args, {
    fixturePath: "fixture.json",
    contextConfigPath: "context.json",
    confirmWrites: true,
  });
}

function testMissingConfirmWritesBlocks() {
  assert.throws(
    () => parseArgs(["--fixture", "fixture.json", "--context-config", "context.json"]),
    /--confirm-writes/,
  );
}

function testMissingFixtureBlocks() {
  assert.throws(
    () => parseArgs(["--context-config", "context.json", "--confirm-writes"]),
    /--fixture/,
  );
}

function testMissingContextConfigBlocks() {
  assert.throws(
    () => parseArgs(["--fixture", "fixture.json", "--confirm-writes"]),
    /--context-config/,
  );
}

function testFixtureParserValidatesObjectArrays() {
  const parsed = parseFixture(JSON.stringify(fixture), "fixture.json");
  assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.postmeta.length, 2);
  assert.equal(parsed.terms.length, 1);
  assert.equal(parsed.placeIndex.length, 1);

  assert.throws(() => parseFixture("[]", "fixture.json"), /must be a JSON object/);
  assert.throws(() => parseFixture(JSON.stringify({ ...fixture, posts: {} }), "fixture.json"), /"posts" must be an array/);
  assert.throws(() => parseFixture(JSON.stringify({ ...fixture, postmeta: null }), "fixture.json"), /"postmeta" must be an array/);
  assert.throws(() => parseFixture(JSON.stringify({ ...fixture, terms: "nope" }), "fixture.json"), /"terms" must be an array/);
  assert.throws(() => parseFixture(JSON.stringify({ ...fixture, placeIndex: 42 }), "fixture.json"), /"placeIndex" must be an array/);
}

async function testFakeExecutorRoutesKnownQueries() {
  const executor = createJsonFixtureExecutor(fixture);

  const posts = await executor(
    "SELECT ID FROM wp_posts WHERE post_type = ? AND post_status = ? LIMIT ?",
    ["places", "publish", 1],
  );
  assert.deepEqual(posts, fixture.posts);

  const postmeta = await executor("SELECT * FROM wp_postmeta WHERE post_id IN (?)", [437]);
  assert.deepEqual(postmeta, fixture.postmeta);

  const terms = await executor("SELECT * FROM wp_term_relationships WHERE object_id IN (?)", [437]);
  assert.deepEqual(terms, fixture.terms);

  const placeIndex = await executor("SELECT * FROM wp_voxel_index_places WHERE post_id IN (?)", [437]);
  assert.deepEqual(placeIndex, fixture.placeIndex);
}

async function testUnknownQueryThrows() {
  const executor = createJsonFixtureExecutor(fixture);
  await assert.rejects(() => executor("SELECT 1", []), /Unexpected query/);
}

function testPackageScriptExists() {
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["migration:commit:wordpress-db-from-json"],
    "tsx scripts/migration-commit-wordpress-db-from-json.ts",
  );
}

function createFakeLedger(): MigrationLineageLookup {
  return {
    async findLineageBySourceRecordKeys() {
      return new Map();
    },
  };
}

// ---------------------------------------------------------------------------
// buildRunners — regression coverage for the stale wiring bug where this
// script's Event runner was still constructed with the removed
// `lineageWriter` dependency instead of `runAtomicCreate`, undetected by
// `tsc --noEmit` because `scripts/` is excluded from `tsconfig.json`. Never
// connects to a real DB: `prisma` is a minimal fake satisfying only the
// two methods `EventCommitRunner.execute()` touches on the CREATE-blocked
// path exercised here (`$transaction`, `migrationRecord.update`), and the
// candidate is deliberately draft-blocked so no domain write is attempted
// through the fake `$transaction`'s `tx` — but `this.deps.runAtomicCreate`
// (the real `runAtomicEventCreate`, not a fake) is still genuinely invoked
// with that `tx`, which is exactly what surfaces
// "this.deps.runAtomicCreate is not a function" if the wiring regresses.
// ---------------------------------------------------------------------------

function createSmokeFakePrisma(): PrismaClient {
  const fake = {
    $transaction: async (fn: (tx: unknown) => unknown) => fn({}),
    migrationRecord: {
      update: async () => ({ id: "record-1" }),
    },
  };
  return fake as unknown as PrismaClient;
}

async function testBuildRunnersWiresEventRunnerWithCallableRunAtomicCreate() {
  const runners = buildRunners(createSmokeFakePrisma());
  assert.ok(runners.event instanceof EventCommitRunner, "buildRunners must construct a real EventCommitRunner");

  const result = await runners.event.execute({
    operation: {
      recordId: "record-1",
      sourceRecordKey: "wordpress-db:events:437",
      targetType: "ACTIVITY",
      action: "CREATE",
      order: 0,
      dependsOn: [],
      rollbackSteps: [],
    },
    record: {
      id: "record-1",
      sourceId: "source-1",
      runId: "run-1",
      status: "PLANNED",
      sourceEntityType: "wordpress-db:events",
      sourceExternalId: null,
      sourceStableKey: "wordpress-db:events:437",
      sourceRecordKey: "wordpress-db:events:437",
      sourceUrl: null,
      canonicalSourceUrl: null,
      sourceUpdatedAt: null,
      sourceHash: "hash-a",
      rawPayloadRef: null,
      rawPayload: null,
      normalizedPayloadRef: null,
      normalizedPayload: null,
      targetTypeHint: "ACTIVITY",
      planAction: "CREATE",
      planSummary: null,
      validationSummary: null,
      dependencyRefs: null,
      mediaRefs: null,
      relationRefs: null,
      redirectRefs: null,
      attemptCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never,
    candidate: {
      title: "Fixture Event",
      slug: "fixture-event",
      content: "<p>content</p>",
      excerpt: "excerpt",
      status: "publish",
      publishedAt: "2026-01-01 00:00:00",
      modifiedAt: "2026-01-02 00:00:00",
      eventDatesRaw: [],
      // Deliberately no schedule — blocks the draft before any domain
      // write, while still routing through the real runAtomicEventCreate.
      scheduleDraft: null,
      venueNameRaw: null,
      locationRaw: null,
      addressEventPlaceRaw: null,
      cityRaw: null,
      priceRaw: null,
      ticketUrlRaw: null,
      externalEventId: null,
      externalLastUpdatedRaw: null,
      trailerUrlRaw: null,
      seo: { title: null, focusKeyword: null },
      sourceTerms: [],
      rawMeta: {},
    } as never,
    context: { ownerUserId: "user-1" } as never,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.reasonCode,
    "EVENT_CREATE_BLOCKED",
    "reaching the typed EVENT_CREATE_BLOCKED result (rather than a thrown TypeError) proves runAtomicCreate was actually invoked as a function",
  );
}

function testExecutionPlanInputIsPlaceOnlyAndDoesNotReadEnv() {
  const input = buildExecutionPlanInputFromJsonFixture({
    executor: createJsonFixtureExecutor(fixture),
    ledger: createFakeLedger(),
  });

  assert.equal(input.adapterKey, "wordpress-db");
  assert.equal(input.sourceNamespace, "wordpress-db");
  assert.deepEqual(input.filters?.entityTypes, ["wordpress-db:places"]);
  assert.equal(input.filters?.limit, 1);
  assert.equal(typeof input.sourceConfig.executor, "function");
}

async function main() {
  testParsesValidFlags();
  testMissingConfirmWritesBlocks();
  testMissingFixtureBlocks();
  testMissingContextConfigBlocks();
  testFixtureParserValidatesObjectArrays();
  await testFakeExecutorRoutesKnownQueries();
  await testUnknownQueryThrows();
  testPackageScriptExists();
  testExecutionPlanInputIsPlaceOnlyAndDoesNotReadEnv();
  await testBuildRunnersWiresEventRunnerWithCallableRunAtomicCreate();
}

main()
  .then(() => {
    console.log("migration-commit-wordpress-db-from-json tests: OK");
  })
  .catch((error) => {
    console.error("migration-commit-wordpress-db-from-json tests: FAILED", error);
    process.exitCode = 1;
  });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MigrationLineageLookup, MigrationRunExecutionPlan } from "../src/lib/migration/core/orchestrator";
import type { CommitCliArgs } from "./migration-commit-wordpress-db";
import {
  applyForcedReprocess,
  buildExecutionPlanInput,
  installServerOnlyStub,
  parseArgs,
  parseCommitContextConfig,
  shouldSampleMedia,
} from "./migration-commit-wordpress-db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FLAGS = ["--context-config", "config.json", "--confirm-writes"];

function testParsesValidFlags() {
  const args = parseArgs([
    "--entity",
    "place",
    "--context-config",
    "config.json",
    "--confirm-writes",
    "--limit",
    "5",
    "--allow-remote-readonly",
    "--out",
    "report.json",
  ]);

  assert.deepEqual(args, {
    entity: "place",
    contextConfigPath: "config.json",
    confirmWrites: true,
    limit: 5,
    sourceRecordKey: undefined,
    forceReprocess: false,
    forceMediaReprocess: false,
    forceArticleMediaReplay: false,
    mediaOwnerUserId: undefined,
    allowRemoteReadonly: true,
    out: "report.json",
    profileName: undefined,
    mediaPolicyName: undefined,
    seoPolicyName: undefined,
    redirectPolicyName: undefined,
    confirmProduction: false,
  });
}

function testDefaultsWhenOptionalFlagsOmitted() {
  const args = parseArgs(REQUIRED_FLAGS);

  assert.equal(args.entity, "all");
  assert.equal(args.limit, undefined);
  assert.equal(args.allowRemoteReadonly, false);
  assert.equal(args.forceReprocess, false);
  assert.equal(args.out, undefined);
}

function testMissingConfirmWritesBlocksBeforeConnection() {
  assert.throws(
    () => parseArgs(["--entity", "place", "--context-config", "config.json"]),
    /--confirm-writes/,
    "omitting --confirm-writes must throw synchronously inside parseArgs, before any connection is attempted",
  );
}

function testMissingContextConfigBlocksBeforeConnection() {
  assert.throws(
    () => parseArgs(["--entity", "place", "--confirm-writes"]),
    /--context-config/,
    "omitting --context-config must throw synchronously inside parseArgs, before any connection is attempted",
  );
}

function testInvalidEntityFails() {
  assert.throws(
    () => parseArgs(["--entity", "offer", ...REQUIRED_FLAGS]),
    /Invalid --entity value "offer"/,
  );
}

function testInvalidLimitFails() {
  assert.throws(
    () => parseArgs(["--limit", "not-a-number", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
  assert.throws(
    () => parseArgs(["--limit", "-5", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
  assert.throws(
    () => parseArgs(["--limit", "0", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
}

function testValidEntityValuesAllParse() {
  for (const entity of ["article", "place", "event", "route", "all"]) {
    const args = parseArgs(["--entity", entity, ...REQUIRED_FLAGS]);
    assert.equal(args.entity, entity);
  }
}

function testForceReprocessAllowsArticleAndPlaceRejectsOtherEntities() {
  // Widened from article-only to also support place (2026-07-15): a
  // partial PlaceMediaSyncer failure never fails the Place commit, but a
  // plain re-run of the same unchanged sourceRecordKey classifies
  // SKIP_UNCHANGED and never reaches mediaSyncer.sync() again —
  // --force-reprocess is the supported way to force a real UPDATE_SAFE
  // pass that retries incomplete media. Event/route have no equivalent
  // known need yet, so they stay rejected rather than silently widened.
  for (const entity of ["event", "route", "all"]) {
    assert.throws(
      () => parseArgs(["--entity", entity, "--force-reprocess", ...REQUIRED_FLAGS]),
      /--entity article\|place/,
      `entity "${entity}" must still be rejected`,
    );
  }
  assert.throws(
    () => parseArgs(["--entity", "article", "--force-reprocess", ...REQUIRED_FLAGS]),
    /--source-record-key/,
  );
  assert.throws(
    () => parseArgs(["--entity", "place", "--force-reprocess", ...REQUIRED_FLAGS]),
    /--source-record-key/,
  );

  const articleArgs = parseArgs([
    "--entity",
    "article",
    "--source-record-key",
    "wordpress-db:post:201",
    "--force-reprocess",
    ...REQUIRED_FLAGS,
  ]);
  assert.equal(articleArgs.forceReprocess, true);

  const placeArgs = parseArgs([
    "--entity",
    "place",
    "--source-record-key",
    "wordpress-db:places:5389",
    "--force-reprocess",
    ...REQUIRED_FLAGS,
  ]);
  assert.equal(placeArgs.forceReprocess, true);
}

function testForceReprocessDisallowsMassModeLimit() {
  assert.throws(
    () =>
      parseArgs([
        "--entity",
        "article",
        "--source-record-key",
        "wordpress-db:post:201",
        "--force-reprocess",
        "--limit",
        "5",
        ...REQUIRED_FLAGS,
      ]),
    /mass mode is not allowed/,
  );
}

// ---------------------------------------------------------------------------
// --force-media-reprocess — narrow media-only Event replay flag. Guard
// logic itself lives in `validateEventMediaOnlyReprocessArgs()`
// (eventMediaOnlyReprocess.test.ts covers it directly); these tests only
// confirm `parseArgs()` wires argv into that guard correctly.
// ---------------------------------------------------------------------------

const FORCE_MEDIA_REPROCESS_BASE_FLAGS = [
  "--entity",
  "event",
  "--source-record-key",
  "wordpress-db:events:56062",
  "--media-policy",
  "FULL",
  "--force-media-reprocess",
];

function testForceMediaReprocessAcceptsEventSourceKeyFull() {
  const args = parseArgs([...FORCE_MEDIA_REPROCESS_BASE_FLAGS, ...REQUIRED_FLAGS]);
  assert.equal(args.forceMediaReprocess, true);
  assert.equal(args.sourceRecordKey, "wordpress-db:events:56062");
  assert.equal(args.mediaPolicyName, "FULL");
}

function testForceMediaReprocessRejectsMissingSourceKey() {
  assert.throws(
    () => parseArgs(["--entity", "event", "--media-policy", "FULL", "--force-media-reprocess", ...REQUIRED_FLAGS]),
    /exactly one --source-record-key/,
  );
}

function testForceMediaReprocessRejectsMultipleSourceKeys() {
  assert.throws(
    () =>
      parseArgs([
        "--entity",
        "event",
        "--source-record-key",
        "wordpress-db:events:56062",
        "--source-record-key",
        "wordpress-db:events:56226",
        "--media-policy",
        "FULL",
        "--force-media-reprocess",
        ...REQUIRED_FLAGS,
      ]),
    /exactly one --source-record-key/,
  );
}

function testForceMediaReprocessRejectsNonEventEntities() {
  for (const entity of ["article", "place", "route"]) {
    assert.throws(
      () =>
        parseArgs([
          "--entity",
          entity,
          "--source-record-key",
          "wordpress-db:events:56062",
          "--media-policy",
          "FULL",
          "--force-media-reprocess",
          ...REQUIRED_FLAGS,
        ]),
      /--entity event/,
      `entity "${entity}" must be rejected`,
    );
  }
}

function testForceMediaReprocessRejectsNonFullMediaPolicy() {
  for (const mediaPolicy of ["METADATA", "NONE"]) {
    assert.throws(
      () =>
        parseArgs([
          "--entity",
          "event",
          "--source-record-key",
          "wordpress-db:events:56062",
          "--media-policy",
          mediaPolicy,
          "--force-media-reprocess",
          ...REQUIRED_FLAGS,
        ]),
      /--media-policy FULL/,
      `media policy "${mediaPolicy}" must be rejected`,
    );
  }
  assert.throws(
    () => parseArgs(["--entity", "event", "--source-record-key", "wordpress-db:events:56062", "--force-media-reprocess", ...REQUIRED_FLAGS]),
    /--media-policy FULL/,
    "omitting --media-policy entirely must also be rejected",
  );
}

function testForceMediaReprocessRejectsCombinationWithForceReprocess() {
  // The pre-existing `--force-reprocess` guard (entity must be article|place)
  // fires first here since `--entity event` never passes it — the
  // combination is still correctly rejected, just via that guard rather
  // than `validateEventMediaOnlyReprocessArgs()`'s own "cannot be combined"
  // branch. That branch is exercised directly (with a fabricated input that
  // bypasses this CLI-level ordering) in eventMediaOnlyReprocess.test.ts.
  assert.throws(
    () =>
      parseArgs([
        ...FORCE_MEDIA_REPROCESS_BASE_FLAGS,
        "--force-reprocess",
        ...REQUIRED_FLAGS,
      ]),
    /--force-reprocess/,
  );
}

// ---------------------------------------------------------------------------
// --force-article-media-replay — narrow media-only Article replay flag.
// Guard logic itself lives in `validateArticleMediaReplayArgs()`
// (articleMediaOnlyReplay.test.ts covers it directly); these tests only
// confirm `parseArgs()` wires argv into that guard correctly.
// ---------------------------------------------------------------------------

const FORCE_ARTICLE_MEDIA_REPLAY_BASE_FLAGS = [
  "--entity",
  "article",
  "--source-record-key",
  "wordpress-db:post:24774",
  "--media-policy",
  "FULL",
  "--media-owner-user-id",
  "user-1",
  "--force-article-media-replay",
];

function testForceArticleMediaReplayAcceptsArticleSourceKeyFullOwner() {
  const args = parseArgs([...FORCE_ARTICLE_MEDIA_REPLAY_BASE_FLAGS, ...REQUIRED_FLAGS]);
  assert.equal(args.forceArticleMediaReplay, true);
  assert.equal(args.sourceRecordKey, "wordpress-db:post:24774");
  assert.equal(args.mediaPolicyName, "FULL");
  assert.equal(args.mediaOwnerUserId, "user-1");
}

function testForceArticleMediaReplayRejectsMissingOwner() {
  assert.throws(
    () =>
      parseArgs([
        "--entity",
        "article",
        "--source-record-key",
        "wordpress-db:post:24774",
        "--media-policy",
        "FULL",
        "--force-article-media-replay",
        ...REQUIRED_FLAGS,
      ]),
    /--media-owner-user-id/,
  );
}

function testForceArticleMediaReplayRejectsNonArticleEntities() {
  for (const entity of ["event", "place", "route"]) {
    assert.throws(
      () =>
        parseArgs([
          "--entity",
          entity,
          "--source-record-key",
          "wordpress-db:post:24774",
          "--media-policy",
          "FULL",
          "--media-owner-user-id",
          "user-1",
          "--force-article-media-replay",
          ...REQUIRED_FLAGS,
        ]),
      /--entity article/,
      `entity "${entity}" must be rejected`,
    );
  }
}

function testForceArticleMediaReplayRejectsNonFullMediaPolicy() {
  for (const mediaPolicy of ["METADATA", "NONE"]) {
    assert.throws(
      () =>
        parseArgs([
          "--entity",
          "article",
          "--source-record-key",
          "wordpress-db:post:24774",
          "--media-policy",
          mediaPolicy,
          "--media-owner-user-id",
          "user-1",
          "--force-article-media-replay",
          ...REQUIRED_FLAGS,
        ]),
      /--media-policy FULL/,
      `media policy "${mediaPolicy}" must be rejected`,
    );
  }
}

function testForceArticleMediaReplayRejectsCombinationWithForceMediaReprocess() {
  // `--force-media-reprocess`'s own guard (`validateEventMediaOnlyReprocessArgs`,
  // entity must be "event") runs first in `parseArgs()` and fires here
  // since entity is "article" — still correctly rejected, just via that
  // guard rather than `validateArticleMediaReplayArgs()`'s own "cannot be
  // combined" branch (exercised directly, with a fabricated input that
  // bypasses this CLI-level ordering, in articleMediaOnlyReplay.test.ts).
  assert.throws(
    () =>
      parseArgs([
        ...FORCE_ARTICLE_MEDIA_REPLAY_BASE_FLAGS,
        "--force-media-reprocess",
        ...REQUIRED_FLAGS,
      ]),
    /--force-media-reprocess/,
  );
}

function testProfileFlagParsesValidValues() {
  for (const profile of ["FULL_IMPORT", "DEV_VALIDATION", "PRODUCTION"]) {
    const args = parseArgs(["--profile", profile, ...REQUIRED_FLAGS]);
    assert.equal(args.profileName, profile);
  }
  assert.equal(parseArgs(REQUIRED_FLAGS).profileName, undefined);
}

function testInvalidProfileFails() {
  assert.throws(
    () => parseArgs(["--profile", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --profile value "bogus"/,
  );
}

function testMediaPolicyFlagParsesValidValues() {
  for (const policy of ["FULL", "METADATA", "NONE"]) {
    const args = parseArgs(["--media-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.mediaPolicyName, policy);
  }
}

function testInvalidMediaPolicyFails() {
  assert.throws(
    () => parseArgs(["--media-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --media-policy value "bogus"/,
  );
}

function testSeoPolicyFlagParsesValidValues() {
  for (const policy of ["DRY_RUN", "VALIDATE", "PRODUCTION"]) {
    const args = parseArgs(["--seo-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.seoPolicyName, policy);
  }
}

function testInvalidSeoPolicyFails() {
  assert.throws(
    () => parseArgs(["--seo-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --seo-policy value "bogus"/,
  );
}

function testRedirectPolicyFlagParsesValidValues() {
  for (const policy of ["VALIDATE", "APPLY"]) {
    const args = parseArgs(["--redirect-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.redirectPolicyName, policy);
  }
}

function testInvalidRedirectPolicyFails() {
  assert.throws(
    () => parseArgs(["--redirect-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --redirect-policy value "bogus"/,
  );
}

function testConfirmProductionFlagParses() {
  assert.equal(parseArgs(REQUIRED_FLAGS).confirmProduction, false);
  assert.equal(parseArgs(["--confirm-production", ...REQUIRED_FLAGS]).confirmProduction, true);
}

function testConfigJsonParsedWhenValid() {
  const config = parseCommitContextConfig(
    JSON.stringify({
      defaults: { place: { createdByUserId: "user-1" } },
      overridesBySourceRecordKey: { "wordpress-db:places:301": { place: { cityId: "city-1" } } },
    }),
    "config.json",
  );

  assert.deepEqual(config.defaults, { place: { createdByUserId: "user-1" } });
  assert.deepEqual(config.overridesBySourceRecordKey, {
    "wordpress-db:places:301": { place: { cityId: "city-1" } },
  });
}

function testConfigJsonAllowsEmptyObject() {
  const config = parseCommitContextConfig("{}", "config.json");
  assert.deepEqual(config, {});
}

function testConfigInvalidJsonFails() {
  assert.throws(() => parseCommitContextConfig("{not valid json", "config.json"), /not valid JSON/);
}

function testConfigNonObjectShapeFails() {
  assert.throws(() => parseCommitContextConfig("[]", "config.json"), /must be a JSON object/);
  assert.throws(() => parseCommitContextConfig("42", "config.json"), /must be a JSON object/);
  assert.throws(() => parseCommitContextConfig("null", "config.json"), /must be a JSON object/);
}

function testConfigDefaultsMustBeObjectIfPresent() {
  assert.throws(
    () => parseCommitContextConfig(JSON.stringify({ defaults: "not-an-object" }), "config.json"),
    /"defaults" must be an object/,
  );
  assert.throws(
    () => parseCommitContextConfig(JSON.stringify({ overridesBySourceRecordKey: ["nope"] }), "config.json"),
    /"overridesBySourceRecordKey" must be an object/,
  );
}

function testPackageScriptExists() {
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["migration:commit:wordpress-db"],
    "tsx scripts/migration-commit-wordpress-db.ts",
  );
}

// A fake `MigrationLineageLookup` — never a real `MigrationLedgerRepository`/
// `PrismaClient` — proving `buildExecutionPlanInput()` wires whatever ledger
// it's given straight through, without needing a real DB connection to test it.
function createFakeLedger(): MigrationLineageLookup {
  return {
    async findLineageBySourceRecordKeys() {
      return new Map();
    },
  };
}

function testBuildExecutionPlanInputPassesLedgerThrough() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({ entity: "place", executor, ledger });

  assert.equal(input.ledger, ledger, "the ledger passed in must land on the built input unchanged, not be dropped or replaced");
}

function testBuildExecutionPlanInputMapsEntityToEntityTypes() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  assert.deepEqual(buildExecutionPlanInput({ entity: "place", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:places",
  ]);
  assert.deepEqual(buildExecutionPlanInput({ entity: "article", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:post",
  ]);
  assert.deepEqual(buildExecutionPlanInput({ entity: "event", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:events",
  ]);
  assert.deepEqual(buildExecutionPlanInput({ entity: "route", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:routes",
  ]);
  assert.equal(buildExecutionPlanInput({ entity: "all", executor, ledger }).filters?.entityTypes, undefined);
}

function testBuildExecutionPlanInputPassesLimitThrough() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({ entity: "all", limit: 5, executor, ledger });
  assert.equal(input.filters?.limit, 5);
}

function testBuildExecutionPlanInputPinsSingleRecordLimit() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({
    entity: "article",
    limit: 500,
    sourceRecordKey: "wordpress-db:post:201",
    records: [
      {
        sourceEntityType: "wordpress-db:post",
        sourceStableKey: "wordpress-db:post:201",
        sourceRecordKey: "wordpress-db:post:201",
      },
    ],
    executor,
    ledger,
  });

  assert.equal(input.filters?.limit, 1);
  assert.equal(input.records?.length, 1);
  assert.equal(input.records?.[0].sourceRecordKey, "wordpress-db:post:201");
}

/** A targeted Place run must pin `limit: 1` and carry exactly the one requested record — never the other 81 published Places. */
function testBuildExecutionPlanInputPinsSingleRecordLimitForPlace() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({
    entity: "place",
    limit: 82,
    sourceRecordKey: "wordpress-db:places:437",
    records: [
      {
        sourceEntityType: "wordpress-db:places",
        sourceStableKey: "wordpress-db:places:437",
        sourceRecordKey: "wordpress-db:places:437",
      },
    ],
    executor,
    ledger,
  });

  assert.equal(input.filters?.limit, 1);
  assert.equal(input.records?.length, 1);
  assert.equal(input.records?.[0].sourceRecordKey, "wordpress-db:places:437");
}

// ---------------------------------------------------------------------------
// shouldSampleMedia — when the sampled media policy activates.
// ---------------------------------------------------------------------------

function testSampleMediaActiveForLocalWithoutExplicitOverride() {
  assert.equal(shouldSampleMedia({ mediaPolicyName: undefined, environment: "LOCAL" }), true);
}

function testSampleMediaActiveForDevWithoutExplicitOverride() {
  assert.equal(shouldSampleMedia({ mediaPolicyName: undefined, environment: "DEV" }), true);
}

function testSampleMediaNeverActiveForProd() {
  assert.equal(shouldSampleMedia({ mediaPolicyName: undefined, environment: "PROD" }), false);
}

function testSampleMediaDisabledByExplicitOverrideOnLocal() {
  assert.equal(shouldSampleMedia({ mediaPolicyName: "FULL", environment: "LOCAL" }), false);
  assert.equal(shouldSampleMedia({ mediaPolicyName: "METADATA", environment: "LOCAL" }), false);
  assert.equal(shouldSampleMedia({ mediaPolicyName: "NONE", environment: "LOCAL" }), false);
}

function testSampleMediaDisabledByExplicitOverrideOnDev() {
  assert.equal(shouldSampleMedia({ mediaPolicyName: "FULL", environment: "DEV" }), false);
}

// ---------------------------------------------------------------------------
// applyForcedReprocess — flips a SKIP_UNCHANGED plan item to UPDATE,
// entity-agnostically (Place's resumable-media-sync mechanism).
// ---------------------------------------------------------------------------

function forceReprocessArgsFixture(overrides: Partial<CommitCliArgs> = {}): CommitCliArgs {
  return {
    entity: "place",
    contextConfigPath: "config.json",
    confirmWrites: true,
    sourceRecordKey: "wordpress-db:places:5389",
    forceReprocess: true,
    allowRemoteReadonly: false,
    confirmProduction: false,
    ...overrides,
  };
}

function planItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    sourceRecordKey: "wordpress-db:places:5389",
    sourceEntityType: "wordpress-db:places",
    action: "SKIP_UNCHANGED",
    status: "SKIPPED",
    targetType: "PLACE",
    ...overrides,
  };
}

function executionPlanFixture(items: ReturnType<typeof planItemFixture>[]): MigrationRunExecutionPlan {
  return {
    plan: {
      adapterKey: "wordpress-db",
      adapterVersion: "1",
      sourceNamespace: "wordpress-db",
      mode: "COMMIT",
      createdAt: new Date().toISOString(),
      records: [],
      items: items as never,
      warnings: [],
      errors: [],
    },
    executionCandidates: items.map((item) => ({ planItem: { ...item } as never, candidate: { fake: true } })),
  };
}

function testApplyForcedReprocessFlipsMatchingPlaceSkipUnchanged() {
  const plan = executionPlanFixture([planItemFixture()]);

  applyForcedReprocess(plan, forceReprocessArgsFixture());

  assert.equal(plan.plan.items[0].action, "UPDATE");
  assert.equal(plan.plan.items[0].status, "PLANNED");
  assert.equal(plan.executionCandidates[0].planItem.action, "UPDATE");
  assert.equal(plan.executionCandidates[0].planItem.status, "PLANNED");
  assert.deepEqual(plan.executionCandidates[0].candidate, { fake: true }, "the real normalized candidate must survive the flip untouched");
}

function testApplyForcedReprocessStillWorksForArticle() {
  // Regression: the original article-only behavior must be unaffected by
  // widening this to Place.
  const plan = executionPlanFixture([
    planItemFixture({ sourceRecordKey: "wordpress-db:post:201", sourceEntityType: "wordpress-db:post", targetType: "ARTICLE" }),
  ]);

  applyForcedReprocess(plan, forceReprocessArgsFixture({ entity: "article", sourceRecordKey: "wordpress-db:post:201" }));

  assert.equal(plan.plan.items[0].action, "UPDATE");
}

function testApplyForcedReprocessIgnoresNonMatchingSourceRecordKey() {
  const plan = executionPlanFixture([planItemFixture({ sourceRecordKey: "wordpress-db:places:99999" })]);

  applyForcedReprocess(plan, forceReprocessArgsFixture());

  assert.equal(plan.plan.items[0].action, "SKIP_UNCHANGED", "a different sourceRecordKey must never be flipped");
}

function testApplyForcedReprocessIgnoresNonSkipUnchangedActions() {
  const plan = executionPlanFixture([planItemFixture({ action: "CREATE", status: "PLANNED" })]);

  applyForcedReprocess(plan, forceReprocessArgsFixture());

  assert.equal(plan.plan.items[0].action, "CREATE", "CREATE/UPDATE items are already going to run — never touched");
}

function testApplyForcedReprocessNoOpWhenFlagNotSet() {
  const plan = executionPlanFixture([planItemFixture()]);

  applyForcedReprocess(plan, forceReprocessArgsFixture({ forceReprocess: false }));

  assert.equal(plan.plan.items[0].action, "SKIP_UNCHANGED");
}

function testApplyForcedReprocessNoOpWhenSourceRecordKeyMissing() {
  const plan = executionPlanFixture([planItemFixture()]);

  applyForcedReprocess(plan, forceReprocessArgsFixture({ sourceRecordKey: undefined }));

  assert.equal(plan.plan.items[0].action, "SKIP_UNCHANGED");
}

// ---------------------------------------------------------------------------
// installServerOnlyStub — real proof `server-only` resolves to a no-op
// afterward, and that this doesn't touch anything else's resolution
// (regression test for the rejected --conditions=react-server approach,
// which broke `react`/`@radix-ui/*` for the rest of this CLI's much wider
// import graph).
// ---------------------------------------------------------------------------

async function testInstallServerOnlyStubNeutralizesServerOnly() {
  installServerOnlyStub();
  // Matches the CLI's real trigger exactly: an ESM dynamic `import()` of a
  // *local* module whose transpiled-to-CJS body does `require("server-only")`
  // as a bare specifier — not a top-level `import("server-only")` here,
  // which resolves via Node's native ESM resolver to an already-absolute
  // path before `Module._load` ever sees it, bypassing the bare-string
  // check entirely (confirmed by reproducing the crash that way first).
  const media = (await import("../src/lib/migration/media")) as unknown as {
    createMamagoMediaImporter: (...args: unknown[]) => unknown;
  };
  assert.equal(typeof media.createMamagoMediaImporter, "function");
}

async function testInstallServerOnlyStubDoesNotAffectOtherModules() {
  installServerOnlyStub();
  const React = await import("react");
  assert.equal(typeof React.createContext, "function", "react must still resolve its normal build, not a react-server one");
}

async function main() {
  testParsesValidFlags();
  testDefaultsWhenOptionalFlagsOmitted();
  testMissingConfirmWritesBlocksBeforeConnection();
  testMissingContextConfigBlocksBeforeConnection();
  testInvalidEntityFails();
  testInvalidLimitFails();
  testValidEntityValuesAllParse();
  testForceReprocessAllowsArticleAndPlaceRejectsOtherEntities();
  testForceReprocessDisallowsMassModeLimit();
  testForceMediaReprocessAcceptsEventSourceKeyFull();
  testForceMediaReprocessRejectsMissingSourceKey();
  testForceMediaReprocessRejectsMultipleSourceKeys();
  testForceMediaReprocessRejectsNonEventEntities();
  testForceMediaReprocessRejectsNonFullMediaPolicy();
  testForceMediaReprocessRejectsCombinationWithForceReprocess();
  testForceArticleMediaReplayAcceptsArticleSourceKeyFullOwner();
  testForceArticleMediaReplayRejectsMissingOwner();
  testForceArticleMediaReplayRejectsNonArticleEntities();
  testForceArticleMediaReplayRejectsNonFullMediaPolicy();
  testForceArticleMediaReplayRejectsCombinationWithForceMediaReprocess();
  testProfileFlagParsesValidValues();
  testInvalidProfileFails();
  testMediaPolicyFlagParsesValidValues();
  testInvalidMediaPolicyFails();
  testSeoPolicyFlagParsesValidValues();
  testInvalidSeoPolicyFails();
  testRedirectPolicyFlagParsesValidValues();
  testInvalidRedirectPolicyFails();
  testConfirmProductionFlagParses();
  testConfigJsonParsedWhenValid();
  testConfigJsonAllowsEmptyObject();
  testConfigInvalidJsonFails();
  testConfigNonObjectShapeFails();
  testConfigDefaultsMustBeObjectIfPresent();
  testPackageScriptExists();
  testBuildExecutionPlanInputPassesLedgerThrough();
  testBuildExecutionPlanInputMapsEntityToEntityTypes();
  testBuildExecutionPlanInputPassesLimitThrough();
  testBuildExecutionPlanInputPinsSingleRecordLimit();
  testBuildExecutionPlanInputPinsSingleRecordLimitForPlace();

  testSampleMediaActiveForLocalWithoutExplicitOverride();
  testSampleMediaActiveForDevWithoutExplicitOverride();
  testSampleMediaNeverActiveForProd();
  testSampleMediaDisabledByExplicitOverrideOnLocal();
  testSampleMediaDisabledByExplicitOverrideOnDev();

  testApplyForcedReprocessFlipsMatchingPlaceSkipUnchanged();
  testApplyForcedReprocessStillWorksForArticle();
  testApplyForcedReprocessIgnoresNonMatchingSourceRecordKey();
  testApplyForcedReprocessIgnoresNonSkipUnchangedActions();
  testApplyForcedReprocessNoOpWhenFlagNotSet();
  testApplyForcedReprocessNoOpWhenSourceRecordKeyMissing();

  await testInstallServerOnlyStubNeutralizesServerOnly();
  await testInstallServerOnlyStubDoesNotAffectOtherModules();
}

// No real DB/SSH anywhere in this file — only `parseArgs()`/
// `parseCommitContextConfig()`/`buildExecutionPlanInput()` (all pure) and a
// read of package.json are exercised. `main()` (the actual WP/Prisma
// wiring) is never called. `buildExecutionPlanInput()`'s ledger tests use a
// fake `MigrationLineageLookup`, never a real `MigrationLedgerRepository`
// or `PrismaClient`. `installServerOnlyStub()`'s tests do real dynamic
// imports (`server-only`, `react`) but never touch a database or network.
main()
  .then(() => {
    console.log("migration-commit-wordpress-db tests: OK");
  })
  .catch((error) => {
    console.error("migration-commit-wordpress-db tests: FAILED", error);
    process.exitCode = 1;
  });

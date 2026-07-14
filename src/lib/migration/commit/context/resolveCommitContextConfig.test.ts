import assert from "node:assert/strict";

import { resolveCommitContextForExecutionCandidate } from "./resolveCommitContextConfig";
import type { MigrationCommitContextConfig } from "./resolveCommitContextConfig";
import type { MigrationExecutionCandidate } from "../../core/orchestrator";
import type { MigrationPlanItem } from "../../types";

function planItemFixture(overrides: Partial<MigrationPlanItem> = {}): MigrationPlanItem {
  return {
    sourceRecordKey: "wordpress-db:places:301",
    sourceEntityType: "wordpress-db:places",
    action: "CREATE",
    status: "PLANNED",
    targetType: "PLACE",
    ...overrides,
  };
}

function executionCandidateFixture(
  overrides: Partial<MigrationExecutionCandidate> = {},
): MigrationExecutionCandidate {
  return {
    planItem: planItemFixture(),
    candidate: { title: "Cool Place" },
    ...overrides,
  };
}

function testPlaceDefaultResolved() {
  const config: MigrationCommitContextConfig = {
    defaults: { place: { createdByUserId: "user-1", cityId: "city-1" } },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture(),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.targetType, "PLACE");
  assert.deepEqual(result.context, { createdByUserId: "user-1", cityId: "city-1" });
}

function testEventDefaultResolved() {
  const config: MigrationCommitContextConfig = {
    defaults: { event: { ownerUserId: "user-1", cityId: "city-1" } },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY" }),
    }),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.targetType, "ACTIVITY");
  assert.deepEqual(result.context, { ownerUserId: "user-1", cityId: "city-1" });
}

function testArticleDefaultResolvedWithoutAuthorUserId() {
  const config: MigrationCommitContextConfig = {
    defaults: { article: { authorLabel: "Editorial Team" } },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:post:201", targetType: "ARTICLE" }),
    }),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.targetType, "ARTICLE");
  assert.deepEqual(result.context, { authorLabel: "Editorial Team" });
  assert.ok(!("authorUserId" in result.context));
}

function testRouteDefaultResolvedWithoutCityId() {
  const config: MigrationCommitContextConfig = {
    defaults: { route: {} },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:routes:701", targetType: "ROUTE" }),
    }),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.targetType, "ROUTE");
  assert.deepEqual(result.context, {});
}

function testRouteOverrideBySourceRecordKeyOverridesDefaults() {
  const config: MigrationCommitContextConfig = {
    defaults: { route: { cityId: "default-city" } },
    overridesBySourceRecordKey: {
      "wordpress-db:routes:701": { route: { cityId: "override-city" } },
    },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:routes:701", targetType: "ROUTE" }),
    }),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.context, { cityId: "override-city" });
}

function testOverrideBySourceRecordKeyOverridesDefaults() {
  const config: MigrationCommitContextConfig = {
    defaults: { place: { createdByUserId: "default-user", cityId: "default-city" } },
    overridesBySourceRecordKey: {
      "wordpress-db:places:301": { place: { cityId: "override-city" } },
    },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture(),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.context, { createdByUserId: "default-user", cityId: "override-city" });
}

function testOverrideOnlyAffectsMatchingSourceRecordKey() {
  const config: MigrationCommitContextConfig = {
    defaults: { place: { createdByUserId: "default-user", cityId: "default-city" } },
    overridesBySourceRecordKey: {
      "wordpress-db:places:999": { place: { cityId: "override-city" } },
    },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture(),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.context, { createdByUserId: "default-user", cityId: "default-city" });
}

function testMissingRequiredPlaceContextReturnsOkFalse() {
  const config: MigrationCommitContextConfig = { defaults: { place: { cityId: "city-1" } } };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture(),
    config,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "MISSING_REQUIRED_CONTEXT_FIELD");
  assert.match(result.errorMessage, /createdByUserId/);
}

function testMissingRequiredEventContextReturnsOkFalse() {
  const config: MigrationCommitContextConfig = { defaults: { event: { cityId: "city-1" } } };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY" }),
    }),
    config,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "MISSING_REQUIRED_CONTEXT_FIELD");
  assert.match(result.errorMessage, /ownerUserId/);
}

function testArticleWithEmptyContextStillResolves() {
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ sourceRecordKey: "wordpress-db:post:201", targetType: "ARTICLE" }),
    }),
    config: {},
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.context, {});
}

function testUnknownTargetTypeReturnsOkFalse() {
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ targetType: "OFFER" }),
    }),
    config: {},
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "UNKNOWN_TARGET_TYPE");
}

function testMissingTargetTypeReturnsOkFalse() {
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture({
      planItem: planItemFixture({ targetType: undefined }),
    }),
    config: {},
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "UNKNOWN_TARGET_TYPE");
}

function testNoMutationOfConfigObject() {
  const config: MigrationCommitContextConfig = {
    defaults: { place: { createdByUserId: "default-user" } },
    overridesBySourceRecordKey: {
      "wordpress-db:places:301": { place: { cityId: "override-city" } },
    },
  };
  const configSnapshot = JSON.parse(JSON.stringify(config));

  resolveCommitContextForExecutionCandidate({ executionCandidate: executionCandidateFixture(), config });

  assert.deepEqual(config, configSnapshot, "resolveCommitContextForExecutionCandidate must never mutate the config it was given");
}

function testExactShallowMergeOverrideWins() {
  const config: MigrationCommitContextConfig = {
    defaults: { place: { createdByUserId: "default-user", cityId: "default-city", category: "default-category" } },
    overridesBySourceRecordKey: {
      "wordpress-db:places:301": { place: { cityId: "override-city" } },
    },
  };
  const result = resolveCommitContextForExecutionCandidate({
    executionCandidate: executionCandidateFixture(),
    config,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Only `cityId` was overridden — `createdByUserId`/`category` must survive
  // from defaults unchanged, proving this is a shallow field-by-field merge,
  // not a full-object replacement.
  assert.deepEqual(result.context, {
    createdByUserId: "default-user",
    cityId: "override-city",
    category: "default-category",
  });
}

function main() {
  testPlaceDefaultResolved();
  testEventDefaultResolved();
  testArticleDefaultResolvedWithoutAuthorUserId();
  testRouteDefaultResolvedWithoutCityId();
  testRouteOverrideBySourceRecordKeyOverridesDefaults();
  testOverrideBySourceRecordKeyOverridesDefaults();
  testOverrideOnlyAffectsMatchingSourceRecordKey();
  testMissingRequiredPlaceContextReturnsOkFalse();
  testMissingRequiredEventContextReturnsOkFalse();
  testArticleWithEmptyContextStillResolves();
  testUnknownTargetTypeReturnsOkFalse();
  testMissingTargetTypeReturnsOkFalse();
  testNoMutationOfConfigObject();
  testExactShallowMergeOverrideWins();
}

main();
console.log("resolveCommitContextConfig tests: OK");

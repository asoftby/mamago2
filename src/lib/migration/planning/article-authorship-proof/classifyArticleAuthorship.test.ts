import assert from "node:assert/strict";
import test from "node:test";

import { classifyArticleAuthorshipEntry, type ArticleAuthorshipEvidence } from "./classifyArticleAuthorship";

function evidence(overrides: Partial<ArticleAuthorshipEvidence> = {}): ArticleAuthorshipEvidence {
  return {
    sourceRecordKey: "wordpress-db:post:940001",
    sourcePostStatus: "publish",
    userLineagePresent: true,
    userExists: true,
    userDeleted: false,
    targetUserId: "user-target-id",
    activeArticleLineageCount: 0,
    activeWrongTypeLineageCount: 0,
    inactiveLineageCount: 0,
    resolvedTargetArticleId: null,
    targetArticleExists: null,
    currentAuthorUserId: null,
    hasAnomalousMigrationRecordHistory: false,
    hasAnyMigrationRecordHistory: false,
    ...overrides,
  };
}

test("a non-publish source status is SOURCE_SCOPE_EXCLUDED, never evaluated further", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ sourcePostStatus: "draft" }));
  assert.equal(result.classification, "SOURCE_SCOPE_EXCLUDED");
  assert.equal(result.reasonCode, "NON_PUBLISH_SOURCE_STATUS");
});

test("missing User lineage is BLOCKED, never guessed at", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ userLineagePresent: false, targetUserId: null }));
  assert.equal(result.classification, "BLOCKED");
  assert.equal(result.reasonCode, "USER_LINEAGE_MISSING");
});

test("a User lineage pointing at a deleted target User is BLOCKED", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ userDeleted: true }));
  assert.equal(result.classification, "BLOCKED");
  assert.equal(result.reasonCode, "TARGET_USER_DELETED");
});

test("no Article lineage at all and no prior attempt is ARTICLE_TARGET_NOT_MIGRATED", () => {
  const result = classifyArticleAuthorshipEntry(evidence());
  assert.equal(result.classification, "ARTICLE_TARGET_NOT_MIGRATED");
  assert.equal(result.reasonCode, "NEVER_ATTEMPTED");
});

test("no Article lineage but a prior MigrationRecord attempt is BLOCKED, not assumed clean", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ hasAnyMigrationRecordHistory: true }));
  assert.equal(result.classification, "BLOCKED");
  assert.equal(result.reasonCode, "PRIOR_ATTEMPT_NO_LINEAGE");
});

test("inactive-only lineage (previously linked, now deactivated) is an ARTICLE_LINEAGE_CONFLICT, not a clean absence", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ inactiveLineageCount: 1 }));
  assert.equal(result.classification, "ARTICLE_LINEAGE_CONFLICT");
  assert.equal(result.reasonCode, "INACTIVE_LINEAGE_ONLY");
});

test("an active lineage row of the wrong targetType is an ARTICLE_LINEAGE_CONFLICT", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ activeWrongTypeLineageCount: 1 }));
  assert.equal(result.classification, "ARTICLE_LINEAGE_CONFLICT");
  assert.equal(result.reasonCode, "LINEAGE_WRONG_TARGET_TYPE");
});

test("two active Article lineage rows for the same source key is a DUPLICATE_ACTIVE conflict", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ activeArticleLineageCount: 2 }));
  assert.equal(result.classification, "ARTICLE_LINEAGE_CONFLICT");
  assert.equal(result.reasonCode, "DUPLICATE_ACTIVE_LINEAGE");
});

test("an active lineage row whose target Article row no longer exists is TARGET_ARTICLE_MISSING", () => {
  const result = classifyArticleAuthorshipEntry(
    evidence({ activeArticleLineageCount: 1, resolvedTargetArticleId: "gone-article-id", targetArticleExists: false }),
  );
  assert.equal(result.classification, "TARGET_ARTICLE_MISSING");
  assert.equal(result.reasonCode, "ARTICLE_ROW_NOT_FOUND");
});

test("exact lineage with an unset current author (and no anomalous history) is an EXACT_AUTHORSHIP_CANDIDATE", () => {
  const result = classifyArticleAuthorshipEntry(
    evidence({ activeArticleLineageCount: 1, resolvedTargetArticleId: "article-1", targetArticleExists: true, currentAuthorUserId: null }),
  );
  assert.equal(result.classification, "EXACT_AUTHORSHIP_CANDIDATE");
  assert.equal(result.reasonCode, "UNSET_AUTHOR_EXACT_LINEAGE");
});

test("an EXACT_AUTHORSHIP_CANDIDATE is downgraded to a conflict when MigrationRecord history is anomalous", () => {
  const result = classifyArticleAuthorshipEntry(
    evidence({
      activeArticleLineageCount: 1,
      resolvedTargetArticleId: "article-1",
      targetArticleExists: true,
      currentAuthorUserId: null,
      hasAnomalousMigrationRecordHistory: true,
    }),
  );
  assert.equal(result.classification, "ARTICLE_LINEAGE_CONFLICT");
  assert.equal(result.reasonCode, "MIGRATION_RECORD_ANOMALY");
});

test("the current author already being the target User is ALREADY_SATISFIED, not re-linked", () => {
  const result = classifyArticleAuthorshipEntry(
    evidence({ activeArticleLineageCount: 1, resolvedTargetArticleId: "article-1", targetArticleExists: true, currentAuthorUserId: "user-target-id" }),
  );
  assert.equal(result.classification, "ALREADY_SATISFIED");
  assert.equal(result.reasonCode, "AUTHOR_ALREADY_TARGET_USER");
});

test("the current author pointing at a different User is an EXISTING_AUTHOR_CONFLICT, never overwritten", () => {
  const result = classifyArticleAuthorshipEntry(
    evidence({ activeArticleLineageCount: 1, resolvedTargetArticleId: "article-1", targetArticleExists: true, currentAuthorUserId: "some-other-user-id" }),
  );
  assert.equal(result.classification, "EXISTING_AUTHOR_CONFLICT");
  assert.equal(result.reasonCode, "AUTHOR_POINTS_TO_DIFFERENT_USER");
});

test("an active lineage row with no targetId at all is an ARTICLE_LINEAGE_CONFLICT, never assumed exact", () => {
  const result = classifyArticleAuthorshipEntry(evidence({ activeArticleLineageCount: 1, resolvedTargetArticleId: null }));
  assert.equal(result.classification, "ARTICLE_LINEAGE_CONFLICT");
  assert.equal(result.reasonCode, "ACTIVE_LINEAGE_MISSING_TARGET_ID");
});

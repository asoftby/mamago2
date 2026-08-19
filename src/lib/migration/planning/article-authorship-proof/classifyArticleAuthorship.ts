import { canonicalHash } from "../user-ownership/canonicalJson";
import type { ArticleAuthorshipReadOnlyRepository } from "./articleAuthorshipReadOnlyRepository";
import type { Slice17ArticleCandidate } from "./loadUser575Articles";
import type { ArticleAuthorshipClassification, ArticleAuthorshipEntry, ArticleLineageState } from "./types";

const ANOMALOUS_MIGRATION_RECORD_STATUSES = new Set(["FAILED", "QUARANTINED"]);

export interface ArticleAuthorshipEvidence {
  sourceRecordKey: string;
  sourcePostStatus: string;
  userLineagePresent: boolean;
  userExists: boolean;
  userDeleted: boolean;
  targetUserId: string | null;
  activeArticleLineageCount: number;
  activeWrongTypeLineageCount: number;
  inactiveLineageCount: number;
  resolvedTargetArticleId: string | null;
  targetArticleExists: boolean | null;
  currentAuthorUserId: string | null;
  hasAnomalousMigrationRecordHistory: boolean;
  hasAnyMigrationRecordHistory: boolean;
}

interface ClassificationResult {
  classification: ArticleAuthorshipClassification;
  articleLineageState: ArticleLineageState;
  reasonCode: string;
  recommendedNextAction: string;
}

/**
 * Pure classification, evidence in, verdict out — no I/O. Precedence is
 * deliberately conservative: any structural anomaly in the lineage
 * bookkeeping (duplicate active rows, wrong target type, inactive-only
 * history, a prior MigrationRecord attempt that left no lineage) is never
 * silently treated as a clean absence — it surfaces as a distinct,
 * manually-reviewable state instead.
 */
export function classifyArticleAuthorshipEntry(evidence: ArticleAuthorshipEvidence): ClassificationResult {
  if (evidence.sourcePostStatus !== "publish") {
    return { classification: "SOURCE_SCOPE_EXCLUDED", articleLineageState: "ABSENT", reasonCode: "NON_PUBLISH_SOURCE_STATUS", recommendedNextAction: "NONE_OUT_OF_SCOPE" };
  }

  if (!evidence.userLineagePresent) {
    return { classification: "BLOCKED", articleLineageState: "ABSENT", reasonCode: "USER_LINEAGE_MISSING", recommendedNextAction: "FOUNDER_DECISION_REQUIRED" };
  }
  if (!evidence.userExists) {
    return { classification: "BLOCKED", articleLineageState: "ABSENT", reasonCode: "TARGET_USER_MISSING", recommendedNextAction: "FOUNDER_DECISION_REQUIRED" };
  }
  if (evidence.userDeleted) {
    return { classification: "BLOCKED", articleLineageState: "ABSENT", reasonCode: "TARGET_USER_DELETED", recommendedNextAction: "FOUNDER_DECISION_REQUIRED" };
  }

  if (evidence.activeWrongTypeLineageCount > 0) {
    return { classification: "ARTICLE_LINEAGE_CONFLICT", articleLineageState: "WRONG_TARGET_TYPE", reasonCode: "LINEAGE_WRONG_TARGET_TYPE", recommendedNextAction: "MANUAL_REVIEW_LINEAGE_ANOMALY" };
  }

  if (evidence.activeArticleLineageCount > 1) {
    return { classification: "ARTICLE_LINEAGE_CONFLICT", articleLineageState: "DUPLICATE_ACTIVE", reasonCode: "DUPLICATE_ACTIVE_LINEAGE", recommendedNextAction: "MANUAL_REVIEW_LINEAGE_ANOMALY" };
  }

  if (evidence.activeArticleLineageCount === 1) {
    if (!evidence.resolvedTargetArticleId) {
      return { classification: "ARTICLE_LINEAGE_CONFLICT", articleLineageState: "ACTIVE_SINGLE", reasonCode: "ACTIVE_LINEAGE_MISSING_TARGET_ID", recommendedNextAction: "MANUAL_REVIEW_LINEAGE_ANOMALY" };
    }
    if (evidence.targetArticleExists === false) {
      return { classification: "TARGET_ARTICLE_MISSING", articleLineageState: "ACTIVE_SINGLE", reasonCode: "ARTICLE_ROW_NOT_FOUND", recommendedNextAction: "MANUAL_REVIEW_BROKEN_LINEAGE" };
    }
    if (evidence.currentAuthorUserId === evidence.targetUserId) {
      return { classification: "ALREADY_SATISFIED", articleLineageState: "ACTIVE_SINGLE", reasonCode: "AUTHOR_ALREADY_TARGET_USER", recommendedNextAction: "NONE_AUTHORSHIP_CLOSED" };
    }
    if (evidence.currentAuthorUserId !== null) {
      return { classification: "EXISTING_AUTHOR_CONFLICT", articleLineageState: "ACTIVE_SINGLE", reasonCode: "AUTHOR_POINTS_TO_DIFFERENT_USER", recommendedNextAction: "FOUNDER_DECISION_REQUIRED_CONFLICT" };
    }
    if (evidence.hasAnomalousMigrationRecordHistory) {
      return { classification: "ARTICLE_LINEAGE_CONFLICT", articleLineageState: "ACTIVE_SINGLE", reasonCode: "MIGRATION_RECORD_ANOMALY", recommendedNextAction: "MANUAL_REVIEW_LINEAGE_ANOMALY" };
    }
    return { classification: "EXACT_AUTHORSHIP_CANDIDATE", articleLineageState: "ACTIVE_SINGLE", reasonCode: "UNSET_AUTHOR_EXACT_LINEAGE", recommendedNextAction: "AUTHORSHIP_GOLDEN_WRITE_CANDIDATE" };
  }

  // activeArticleLineageCount === 0 from here on.
  if (evidence.inactiveLineageCount > 0) {
    return { classification: "ARTICLE_LINEAGE_CONFLICT", articleLineageState: "INACTIVE_ONLY", reasonCode: "INACTIVE_LINEAGE_ONLY", recommendedNextAction: "MANUAL_REVIEW_LINEAGE_ANOMALY" };
  }
  if (evidence.hasAnyMigrationRecordHistory) {
    return { classification: "BLOCKED", articleLineageState: "ABSENT", reasonCode: "PRIOR_ATTEMPT_NO_LINEAGE", recommendedNextAction: "FOUNDER_DECISION_REQUIRED" };
  }
  return { classification: "ARTICLE_TARGET_NOT_MIGRATED", articleLineageState: "ABSENT", reasonCode: "NEVER_ATTEMPTED", recommendedNextAction: "SELECT_FOR_ARTICLE_GOLDEN_MIGRATION" };
}

/** Gathers evidence for one candidate through the narrow read-only repository — every lookup keyed by exact sourceRecordKey/id. */
async function gatherEvidence(
  repository: ArticleAuthorshipReadOnlyRepository,
  candidate: Slice17ArticleCandidate,
  userLineage: { targetUserId: string | null; userExists: boolean; userDeleted: boolean },
): Promise<ArticleAuthorshipEvidence> {
  const userLineagePresent = userLineage.targetUserId !== null;

  const lineageRows = await repository.findLineageRowsForSourceKey(candidate.sourceRecordKey);
  const activeArticleRows = lineageRows.filter(row => row.targetType === "ARTICLE" && row.isActive);
  const activeWrongTypeRows = lineageRows.filter(row => row.targetType !== "ARTICLE" && row.isActive);
  const inactiveRows = lineageRows.filter(row => !row.isActive);

  const resolvedTargetArticleId = activeArticleRows.length === 1 ? (activeArticleRows[0].targetId ?? null) : null;
  let targetArticleExists: boolean | null = null;
  let currentAuthorUserId: string | null = null;
  if (resolvedTargetArticleId) {
    const article = await repository.findArticleById(resolvedTargetArticleId);
    targetArticleExists = article !== null;
    currentAuthorUserId = article?.authorUserId ?? null;
  }

  const migrationRecordStatuses = await repository.findMigrationRecordStatuses(candidate.sourceRecordKey);

  return {
    sourceRecordKey: candidate.sourceRecordKey,
    sourcePostStatus: candidate.postStatus,
    userLineagePresent,
    userExists: userLineage.userExists,
    userDeleted: userLineage.userDeleted,
    targetUserId: userLineage.targetUserId,
    activeArticleLineageCount: activeArticleRows.length,
    activeWrongTypeLineageCount: activeWrongTypeRows.length,
    inactiveLineageCount: inactiveRows.length,
    resolvedTargetArticleId,
    targetArticleExists,
    currentAuthorUserId,
    hasAnomalousMigrationRecordHistory: migrationRecordStatuses.some(status => ANOMALOUS_MIGRATION_RECORD_STATUSES.has(status)),
    hasAnyMigrationRecordHistory: migrationRecordStatuses.length > 0,
  };
}

/**
 * Builds the full, deterministic, sanitised Slice 17 manifest: one User
 * lineage lookup (shared across all candidates, since they're the same
 * author), then per-candidate evidence gathering and classification.
 * Entries are sorted by sourceRecordKey for determinism. The author's
 * sourceRecordKey is an explicit parameter (not hardcoded) so this
 * orchestrator is independently testable against synthetic authors.
 */
export async function buildArticleAuthorshipProof(
  repository: ArticleAuthorshipReadOnlyRepository,
  authorUserSourceRecordKey: string,
  candidates: readonly Slice17ArticleCandidate[],
): Promise<readonly ArticleAuthorshipEntry[]> {
  const userLineage = await repository.findUserLineage(authorUserSourceRecordKey);

  const entries: ArticleAuthorshipEntry[] = [];
  for (const candidate of candidates) {
    const evidence = await gatherEvidence(repository, candidate, userLineage);
    const result = classifyArticleAuthorshipEntry(evidence);
    const entryCore = {
      sourceRecordKey: candidate.sourceRecordKey,
      sourcePostStatus: candidate.postStatus,
      targetUserId: userLineage.targetUserId,
      articleLineageState: result.articleLineageState,
      targetArticleId: evidence.resolvedTargetArticleId,
      currentAuthorUserId: evidence.currentAuthorUserId,
      classification: result.classification,
      reasonCode: result.reasonCode,
      recommendedNextAction: result.recommendedNextAction,
    };
    entries.push({ ...entryCore, evidenceHash: canonicalHash(entryCore) });
  }

  return entries.sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}

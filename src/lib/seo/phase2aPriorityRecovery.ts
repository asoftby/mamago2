import {
  PHASE_2A_PRIORITY_RECOVERIES as PHASE_2A_PRIORITY_RECOVERIES_SOURCE,
} from "./phase2aPriorityRecoverySource";
import type {
  Phase2ARecoveryEntry as SourcePhase2ARecoveryEntry,
  Phase2Action,
  Phase2PlanAction,
  ReadinessLevel,
} from "./phase2aPriorityRecoverySource";

export type { Phase2Action, Phase2PlanAction, ReadinessLevel };

/**
 * Canonical Phase 2A entry exposed to recovery consumers.
 *
 * `resolvedGeoScope` is used for owner-reviewed geography that requires a
 * dedicated recovery path not supported by the generic CITY/COUNTRY batch.
 * Keeping `geoScope` null for such rows makes the generic repair fail closed,
 * while the committed exact mapping records the owner decision explicitly.
 */
export type Phase2ARecoveryEntry = SourcePhase2ARecoveryEntry & {
  resolvedGeoScope?: "REGION";
  regionSlug?: string | null;
  ownerDecision?: string;
};

const GRODNO_REGION_ARTICLE_ID = "cmssu87vb00jews3fk0gbskm1";
const GRODNO_REGION_SLUG = "grodnenskaya-oblast";
const GRODNO_OWNER_DECISION =
  "2026-09-04: restore as REGION / Гродненская область; no Grodno City row exists in PROD; use dedicated REGION-aware recovery and canonical /blog/{slug}.";

/**
 * Canonical recovery registry.
 *
 * The historical source remains immutable in phase2aPriorityRecoverySource.ts;
 * reviewed decisions are layered here so owner-review resolutions are explicit,
 * auditable, and cannot silently enter the generic automated batch.
 */
export const PHASE_2A_PRIORITY_RECOVERIES: Phase2ARecoveryEntry[] =
  PHASE_2A_PRIORITY_RECOVERIES_SOURCE.map((entry) =>
    entry.position === 11
      ? {
          ...entry,
          targetArticleId: GRODNO_REGION_ARTICLE_ID,
          readiness: "READY_WITH_EXACT_MAPPING",
          geoScope: null,
          citySlug: null,
          confidence: "HIGH",
          evidence:
            "Owner/product decision 2026-09-04: restore as REGION / Grodnenskaya oblast. PROD has no Grodno City row, while region_grodnenskaya_oblast exists; the exact audited article covers Grodno and surroundings. Dedicated guarded recovery publishes the exact Article ID and uses canonical /blog/{slug}; the legacy /minsk/blog redirect is corrected separately.",
          ownerReviewBatch: undefined,
          resolvedGeoScope: "REGION",
          regionSlug: GRODNO_REGION_SLUG,
          ownerDecision: GRODNO_OWNER_DECISION,
        }
      : entry,
  );

export function summarizePhase2A(): {
  total: number;
  totalClicks: number;
  actionBreakdown: Record<string, number>;
  readinessBreakdown: Record<string, number>;
  geoBreakdown: Record<string, number>;
  ownerReviewBatches: Record<string, number>;
} {
  const total = PHASE_2A_PRIORITY_RECOVERIES.length;
  const totalClicks = PHASE_2A_PRIORITY_RECOVERIES.reduce((sum, r) => sum + r.gscClicks, 0);
  const actionBreakdown: Record<string, number> = {};
  const readinessBreakdown: Record<string, number> = {};
  const geoBreakdown: Record<string, number> = {};
  const ownerReviewBatches: Record<string, number> = {};

  for (const entry of PHASE_2A_PRIORITY_RECOVERIES) {
    actionBreakdown[entry.action] = (actionBreakdown[entry.action] ?? 0) + 1;
    readinessBreakdown[entry.readiness] = (readinessBreakdown[entry.readiness] ?? 0) + 1;
    const geoKey = entry.resolvedGeoScope ?? entry.geoScope ?? "null";
    geoBreakdown[geoKey] = (geoBreakdown[geoKey] ?? 0) + 1;
    if (entry.ownerReviewBatch) {
      ownerReviewBatches[entry.ownerReviewBatch] =
        (ownerReviewBatches[entry.ownerReviewBatch] ?? 0) + 1;
    }
  }

  return { total, totalClicks, actionBreakdown, readinessBreakdown, geoBreakdown, ownerReviewBatches };
}

/** Get all entries with a specific readiness level. */
export function entriesByReadiness(level: ReadinessLevel): Phase2ARecoveryEntry[] {
  return PHASE_2A_PRIORITY_RECOVERIES.filter((entry) => entry.readiness === level);
}

/** Get entries for a specific owner-review batch. */
export function entriesByOwnerReviewBatch(batchId: string): Phase2ARecoveryEntry[] {
  return PHASE_2A_PRIORITY_RECOVERIES.filter((entry) => entry.ownerReviewBatch === batchId);
}

/** Validate that all positions are unique and sequential and exact owner decisions remain coherent. */
export function validatePhase2AIntegrity(): string[] {
  const errors: string[] = [];
  const positions = PHASE_2A_PRIORITY_RECOVERIES.map((entry) => entry.position);
  const uniquePositions = new Set(positions);
  if (uniquePositions.size !== positions.length) {
    errors.push(`Duplicate positions: ${positions.length} total, ${uniquePositions.size} unique`);
  }
  for (let i = 1; i <= positions.length; i++) {
    if (!positions.includes(i)) errors.push(`Missing position ${i}`);
  }
  if (positions[0] !== 1) errors.push(`First position is ${positions[0]} instead of 1`);

  const automatedArticles = PHASE_2A_PRIORITY_RECOVERIES.filter((entry) =>
    entry.entityType === "article" &&
    entry.action === "RESTORE_EXISTING_CONTENT" &&
    entry.readiness === "READY_AUTOMATED",
  );
  for (const entry of automatedArticles) {
    if (!entry.targetArticleId) errors.push(`Position ${entry.position}: missing audited targetArticleId`);
  }
  if (new Set(automatedArticles.map((entry) => entry.targetArticleId)).size !== automatedArticles.length) {
    errors.push("Automated article targetArticleId values must be unique");
  }

  const grodno = PHASE_2A_PRIORITY_RECOVERIES.find((entry) => entry.position === 11);
  if (
    !grodno ||
    grodno.targetArticleId !== GRODNO_REGION_ARTICLE_ID ||
    grodno.readiness !== "READY_WITH_EXACT_MAPPING" ||
    grodno.geoScope !== null ||
    grodno.resolvedGeoScope !== "REGION" ||
    grodno.regionSlug !== GRODNO_REGION_SLUG ||
    !grodno.ownerDecision ||
    grodno.ownerReviewBatch !== undefined
  ) {
    errors.push("Position 11: Grodno owner-reviewed REGION mapping is inconsistent");
  }

  return errors;
}
